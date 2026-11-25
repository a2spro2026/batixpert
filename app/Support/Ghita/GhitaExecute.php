<?php

namespace App\Support\Ghita;

use App\Models\Client;
use App\Support\ClientPlafond;

class GhitaExecute
{
    public function act(string $raw, string $q, array $context = [], ?array $pending = null): ?array
    {
        $resume = ($pending['action'] ?? null) === 'set_plafond';
        if (! $this->isPlafondOrder($q) && ! $resume) {
            return null;
        }
        if ($this->isQuestion($q) && ! $this->wantsWrite($q)) {
            return null;
        }

        $client = $this->findClient($raw, $q);
        if ($this->pronoun($q) || $client === null) {
            $client = $client ?: $this->clientFromContext($context);
        }
        if ($resume && $client === null && ! empty($pending['client_id'])) {
            $client = Client::find((int) $pending['client_id']);
        }
        if (! $client) {
            return $this->out('Pour quel client ?', $context, ['set_plafond' => true]);
        }

        if ($this->clears($q)) {
            return $this->save($client, null, $context);
        }

        $amount = $this->amount($raw);
        if ($amount === null) {
            $next = $context;
            $next['focus'] = 'client';
            $next['client_id'] = $client->id;
            $next['client_name'] = $client->name;

            return $this->out('Quel montant pour le plafond de '.$client->name.' ?', $next, [
                'action' => 'set_plafond',
                'client_id' => $client->id,
            ]);
        }
        if ($amount < 0) {
            return $this->out('Le plafond ne peut pas être négatif.', $context);
        }

        return $this->save($client, round($amount, 2), $context);
    }

    private function save(Client $client, ?float $plafond, array $context): array
    {
        $client->plafond = $plafond;
        $client->save();
        $snap = ClientPlafond::snapshot($client->fresh());
        $next = $context;
        $next['focus'] = 'client';
        $next['client_id'] = $client->id;
        $next['client_name'] = $client->name;

        if ($snap['plafond'] === null) {
            $reply = 'C\'est enregistré. '.$client->name.' n\'a plus de plafond. Son encours reste '.$this->money($snap['solde']).' DH. Une vente n\'est pas bloquée par le crédit.';
        } else {
            $reply = 'C\'est enregistré. Plafond de '.$client->name.' : '.$this->money($snap['plafond']).' DH. Encours '.$this->money($snap['solde']).' DH. Reste disponible '.$this->money($snap['reste']).' DH.';
            if ((float) $snap['solde'] > (float) $snap['plafond'] + 0.001) {
                $reply .= ' L\'encours dépasse déjà ce plafond.';
            }
        }

        return $this->out($reply, $next, null, [
            'client_id' => $client->id,
            'plafond' => $snap['plafond'],
            'solde' => $snap['solde'],
            'reste' => $snap['reste'],
        ]);
    }

    private function isPlafondOrder(string $q): bool
    {
        if (! $this->mentionsPlafond($q)) {
            return false;
        }

        return $this->wantsWrite($q) || $this->clears($q) || ($this->amount($q) !== null && ! $this->isQuestion($q));
    }

    private function mentionsPlafond(string $q): bool
    {
        if (str_contains($q, 'plafond') || str_contains($q, 'plafon')) {
            return true;
        }
        foreach (preg_split('/\s+/', $q) ?: [] as $word) {
            if (mb_strlen($word) >= 5 && levenshtein($word, 'plafond') <= 2) {
                return true;
            }
        }

        return false;
    }

    private function wantsWrite(string $q): bool
    {
        return (bool) preg_match('/\b(saisi\w*|saisir|mets|met|mettre|fixe\w*|enregistr\w*|defini\w*|modifi\w*|chang\w*|pose|attribue\w*|affect\w*|renseign\w*|rempli\w*|passe|donn\w*)\b/', $q);
    }

    private function clears(string $q): bool
    {
        return (bool) preg_match('/\b(enleve\w*|retir\w*|supprim\w*|effac\w*|aucun|sans|vide)\b/', $q);
    }

    private function isQuestion(string $q): bool
    {
        return (bool) preg_match('/\b(quel|quelle|quels|combien|chhal|ch7al)\b/', $q);
    }

    private function pronoun(string $q): bool
    {
        return (bool) preg_match('/\b(lui|elle|son|sa|ses|ce client|au client|le client)\b/', $q);
    }

    private function findClient(string $raw, string $q): ?Client
    {
        if (preg_match('/\bCR-0*(\d+)/i', $raw, $match)) {
            return Client::find((int) $match[1]);
        }

        $best = null;
        $score = 0;
        foreach (Client::query()->get() as $client) {
            $name = $this->prepare($client->name);
            if (mb_strlen($name) >= 4 && str_contains($q, $name) && mb_strlen($name) > $score) {
                $best = $client;
                $score = mb_strlen($name);
            }
            foreach (preg_split('/\s+/', $name) ?: [] as $word) {
                if (mb_strlen($word) < 4 || in_array($word, ['societe', 'ste', 'sarl', 'btp'], true)) {
                    continue;
                }
                if (preg_match('/\b'.preg_quote($word, '/').'\b/', $q) && mb_strlen($word) > $score) {
                    $best = $client;
                    $score = mb_strlen($word);
                }
            }
        }

        return $best;
    }

    private function clientFromContext(array $context): ?Client
    {
        $id = $context['client_id'] ?? null;

        return $id ? Client::find($id) : null;
    }

    private function amount(string $raw): ?float
    {
        $clean = preg_replace('/\bC[RF]-\d+/i', ' ', $raw) ?? $raw;
        if (! preg_match_all('/\d{1,3}(?:[ \x{00A0}]\d{3})+(?:,\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+[.,]\d{1,2}|\d+/u', $clean, $matches)) {
            return null;
        }
        $parsed = [];
        foreach ($matches[0] as $token) {
            $parsed[] = $this->parseAmount($token);
        }
        $parsed = array_values(array_filter($parsed, fn ($value) => $value !== null));
        if ($parsed === []) {
            return null;
        }
        $meaningful = array_values(array_filter($parsed, fn ($value) => $value >= 1));
        $chosen = $meaningful !== [] ? $meaningful : $parsed;
        $value = $chosen[array_key_last($chosen)];

        return round((float) $value, 2);
    }

    private function parseAmount(string $token): ?float
    {
        $token = str_replace(["\u{00A0}", ' '], '', $token);
        if (preg_match('/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/', $token)) {
            $token = str_replace('.', '', $token);
            $token = str_replace(',', '.', $token);
        } elseif (str_contains($token, ',') || preg_match('/\.\d{1,2}$/', $token)) {
            $token = str_replace(',', '.', $token);
        }

        return is_numeric($token) ? round((float) $token, 2) : null;
    }

    private function out(string $reply, array $context, ?array $pending = null, ?array $refresh = null): array
    {
        return [
            'reply' => $reply,
            'context' => $context,
            'pending' => $pending,
            'suggestions' => ['Quel est son plafond ?', 'Combien lui reste-t-il ?'],
            'refresh' => $refresh,
        ];
    }

    private function prepare(string $value): string
    {
        $value = mb_strtolower($value);
        $value = strtr($value, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ù' => 'u', 'û' => 'u',
            'ô' => 'o', 'î' => 'i', 'ï' => 'i', 'ç' => 'c',
        ]);
        $value = str_replace(['’', '\''], ' ', $value);

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value);
    }

    private function money(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ');
    }
}
