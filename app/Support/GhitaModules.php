<?php

namespace App\Support;

use App\Models\Chantier;
use App\Models\Client;
use App\Models\Document;
use App\Models\GhitaMemory;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\Supplier;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GhitaModules
{
    public function __construct(private ?User $user = null) {}

    public function detect(string $q): ?string
    {
        if (preg_match('/\b(retiens|memoire|souvenir|souviens|note que|decide que)\b/', $q)) {
            return 'memoire';
        }
        if (preg_match('/\b(document|documents|pdf|excel|word|fichier)\b/', $q)) {
            return 'documents';
        }
        if (preg_match('/\b(plan de travail|plan d action|exemple de plan|feuille de route)\b/', $q)
            || (preg_match('/\b(plan|travail)\b/', $q) && preg_match('/\b(execut|exemple|a faire|aujourdhui|priorit)\b/', $q))) {
            return 'projets';
        }
        if (preg_match('/\b(cree la tache|creer une tache|creer la tache|automatise)\b/', $q)
            || preg_match('/\b(execute|executer)\b/', $q) && preg_match('/\b(tache|memoire|decision|action)\b/', $q)) {
            return 'automatisation';
        }
        if (preg_match('/\b(je veux|je pense|on devrait|bonne idee|mauvaise idee|tu es daccord|tu conseilles)\b/', $q)) {
            return 'conseil';
        }
        if (preg_match('/\bje vais\b/', $q) && preg_match('/achet|command|depens|invest|payer|accord|depass/', $q)) {
            return 'conseil';
        }
        if (preg_match('/\b(analyse|performance|chiffres|resultat|marge|probleme)\b/', $q)) {
            return 'analyse';
        }
        if (preg_match('/\b(projet|projets|objectif|objectifs|tache|taches|echeance|echeances|chantier|chantiers)\b/', $q)) {
            return 'projets';
        }
        if (preg_match('/\b(cherche|recherche|trouve|synthese|synthetise)\b/', $q)) {
            return 'recherche';
        }

        return null;
    }

    public function label(string $q): ?string
    {
        return match ($q) {
            'conversation' => 'conversation',
            'memoire' => 'memoire',
            'conseil' => 'conseil',
            'analyse' => 'analyse',
            'projet', 'projets' => 'projets',
            'recherche' => 'recherche',
            'document', 'documents' => 'documents',
            'automatisation', 'actions' => 'automatisation',
            default => null,
        };
    }

    public function briefing(string $module): array
    {
        $figures = $this->figures();

        $reply = match ($module) {
            'memoire' => $this->recall() ?: 'Ma mémoire est vide. Dites « retiens : » suivi de la décision ou du projet.',
            'conseil' => 'Posez la décision. Je la compare aux chiffres. Si elle aggrave l\'écart achats / ventes, je dirai non.',
            'analyse' => $this->analysis(),
            'projets' => $this->projects(),
            'recherche' => 'Donnez un nom, un code ou un sujet. Je cherche dans les clients, fournisseurs, chantiers, produits et documents, puis je résume.',
            'documents' => $this->documents(''),
            'automatisation' => 'Je n\'exécute que ce que vous autorisez. Je peux retenir une décision, ou créer une tâche sur un chantier après votre oui.',
            default => 'Dites ce que vous voulez savoir. Je réponds à partir du système, et je contredis une décision si les montants ne la tiennent pas.',
        };

        if ($module === 'conseil' && $figures['ecart'] > 0) {
            $reply .= ' Écart actuel : '.$this->money($figures['ecart']).' d\'achats au-dessus des ventes.';
        }

        return ['reply' => $reply];
    }

    public function handle(string $module, string $raw, string $q): ?array
    {
        return match ($module) {
            'memoire' => ['reply' => $this->memory($raw, $q)],
            'conseil' => ['reply' => $this->conseil($raw, $q)],
            'analyse' => ['reply' => $this->analysis()],
            'projets' => ['reply' => $this->projects($q)],
            'recherche' => ['reply' => $this->research($raw, $q)],
            'documents' => ['reply' => $this->documents($q)],
            'automatisation' => $this->automation($raw, $q),
            default => null,
        };
    }

    public function confirms(string $q): bool
    {
        return (bool) preg_match('/\b(oui|confirme|confirmer|vas y|vas-y|enregistre|execute|daccord)\b/', $q);
    }

    public function cancels(string $q): bool
    {
        return $q === 'non' || str_contains($q, 'annule');
    }

    public function execute(array $pending): string
    {
        $action = $pending['action'] ?? '';
        if ($action === 'remember') {
            $this->store($pending['kind'] ?? 'decision', (string) ($pending['content'] ?? ''), $pending['due_on'] ?? null);

            return 'C\'est enregistré dans ma mémoire. '.$pending['content'];
        }
        if ($action === 'task') {
            $chantier = Chantier::find($pending['chantier_id'] ?? 0);
            if (! $chantier) {
                return 'Le chantier n\'existe plus. Je ne crée pas la tâche.';
            }
            Task::create([
                'chantier_id' => $chantier->id,
                'title' => Str::limit((string) ($pending['title'] ?? 'Tâche'), 180, ''),
                'description' => $pending['content'] ?? null,
                'due_date' => $pending['due_on'] ?? null,
                'priority' => 'haute',
                'status' => 'a_faire',
            ]);
            $when = $pending['due_on'] ?? null;

            return 'Tâche créée sur '.$chantier->name.' : '.$pending['title'].($when ? '. Échéance '.date('d/m/Y', strtotime($when)).'.' : '.');
        }

        return 'Cette action n\'est pas dans ce que je suis autorisée à exécuter.';
    }

    public function figures(): array
    {
        $achats = round((float) PurchaseOrder::query()->where('status', '!=', 'annule')->sum('total_ttc'), 2);
        $ventes = round((float) SaleOrder::query()->where('status', '!=', 'annule')->sum('total_ttc'), 2);
        $encaisser = round((float) SaleOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
            ->value('reste'), 2);
        $decaisser = round((float) PurchaseOrder::query()
            ->where('status', '!=', 'annule')
            ->selectRaw('COALESCE(SUM(GREATEST(ROUND(total_ttc - COALESCE(montant_paye, 0), 2), 0)), 0) as reste')
            ->value('reste'), 2);

        return [
            'achats' => $achats,
            'ventes' => $ventes,
            'ecart' => round($achats - $ventes, 2),
            'encaisser' => $encaisser,
            'decaisser' => $decaisser,
        ];
    }

    private function memory(string $raw, string $q): string
    {
        if (preg_match('/(tu retiens|as tu retenu|ta memoire|tes souvenirs|que retiens)/', $q) || $q === 'memoire') {
            return $this->recall() ?: 'Je n\'ai encore rien retenu.';
        }
        if (preg_match('/\b(retiens|note que|decide que|decide)\b/', $q)) {
            $content = trim((string) preg_replace('/^.*?\b(retiens|note que|décide que|decide que|décide|decide)\b[:\s,]*/iu', '', $raw));
            if ($content === '' || mb_strlen($content) < 3) {
                return 'Dites la décision après « retiens : ». Je n\'invente pas ce qu\'il faut garder.';
            }
            $kind = str_contains($q, 'projet') ? 'projet' : (str_contains($q, 'objectif') ? 'objectif' : 'decision');
            $this->store($kind, $content, $this->extractDate($raw));

            return 'Je le retiens comme '.$this->kindLabel($kind).' : '.$content;
        }

        return $this->recall() ?: 'Dites « retiens : » suivi de la décision, ou demandez ce que je retiens.';
    }

    private function conseil(string $raw, string $q): string
    {
        $figures = $this->figures();
        $spend = (bool) preg_match('/achet|command|depens|invest|payer|decaiss|accorder un delai|depass/', $q);
        $collect = (bool) preg_match('/relanc|encaiss|impay|recouvr|plafond/', $q);
        $client = $this->findClient($q);
        $amount = $this->extractAmount($raw);

        if ($client && $client->plafond !== null && $amount !== null) {
            $snapshot = ClientPlafond::snapshot($client);
            if ($amount > (float) $snapshot['reste'] + 0.001) {
                return 'Non. '.$client->name.' a un plafond de '.$this->money($snapshot['plafond']).' et un solde de '.$this->money($snapshot['solde']).'. Il reste '.$this->money($snapshot['reste']).'. Une commande de '.$this->money($amount).' dépasse le cadre. Soit vous réduisez le montant, soit vous, gérant, autorisez le dépassement en connaissance de cause.';
            }
        }

        if ($spend && $figures['ecart'] > 0) {
            return 'Je ne suis pas d\'accord. Les achats sont à '.$this->money($figures['achats']).', les ventes à '.$this->money($figures['ventes']).'. L\'écart est '.$this->money($figures['ecart']).', et il reste '.$this->money($figures['decaisser']).' à décaisser. Acheter encore aggrave la trésorerie. Décision tenable : encaisser les ventes ouvertes, puis n\'acheter que le besoin d\'un chantier déjà engagé.';
        }

        if ($collect && $figures['encaisser'] <= 0) {
            return 'Non. Il n\'y a pas de vente ouverte à encaisser. Le point dur est '.$this->money($figures['decaisser']).' à décaisser, pour des achats sans vente en face. Relancer un impayé qui n\'existe pas ne change rien. Négociez l\'échéance fournisseur, ou stoppez les achats.';
        }

        if ($collect) {
            return 'Oui. C\'est la priorité. Il reste '.$this->money($figures['encaisser']).' à encaisser et '.$this->money($figures['decaisser']).' à décaisser. Commencez par les plus anciens impayés, pas par une nouvelle dépense.';
        }

        if ($figures['ecart'] > 0) {
            return 'Je ne valide pas l\'idée en l\'état. L\'écart achats moins ventes est '.$this->money($figures['ecart']).'. Donnez le montant et le client ou le fournisseur. Je dirai si c\'est tenable.';
        }

        return 'Les ventes couvrent les achats. Donnez le montant et la contrepartie. Je confirme seulement si le reste à encaisser le permet.';
    }

    private function analysis(): string
    {
        $figures = $this->figures();
        $lines = [
            'Achats '.$this->money($figures['achats']).'. Ventes '.$this->money($figures['ventes']).'.',
            'À encaisser '.$this->money($figures['encaisser']).'. À décaisser '.$this->money($figures['decaisser']).'.',
        ];
        if ($figures['ecart'] > 0) {
            $lines[] = 'Lecture : vous avez acheté '.$this->money($figures['ecart']).' de plus que vous n\'avez vendu. La priorité n\'est pas d\'acheter. C\'est d\'encaisser, ou d\'arrêter les achats sans vente en face.';
        } elseif ($figures['ventes'] > $figures['achats']) {
            $lines[] = 'Lecture : les ventes dépassent les achats de '.$this->money(abs($figures['ecart'])).'. Tenez cette marge. Ne la rendez pas par un délai ou une remise sans contrepartie.';
        } else {
            $lines[] = 'Lecture : achats et ventes sont au même niveau. Surveillez le reste à décaisser avant tout nouvel engagement.';
        }

        return implode("\n", $lines);
    }

    private function projects(string $q = ''): string
    {
        if (preg_match('/\b(plan de travail|plan d action|exemple de plan|feuille de route)\b/', $q)
            || (preg_match('/\b(plan|travail)\b/', $q) && preg_match('/\b(execut|exemple|a faire|aujourdhui|priorit)\b/', $q))) {
            return $this->workPlan();
        }
        if (str_contains($q, 'retard') || str_contains($q, 'tache')) {
            return $this->lateTasks() ?: 'Aucune tâche en retard.';
        }

        $chantiers = Chantier::query()->where('archived', false)->where('status', 'en_cours')->orderBy('end_date')->limit(6)->get();
        $lines = [];
        if ($chantiers->isEmpty()) {
            $lines[] = 'Aucun chantier en cours.';
        } else {
            $lines[] = $chantiers->count().' chantier'.($chantiers->count() > 1 ? 's' : '').' en cours.';
            foreach ($chantiers as $chantier) {
                $end = $chantier->end_date?->format('d/m/Y') ?: 'sans échéance';
                $late = $chantier->end_date && $chantier->end_date->isPast() ? ' En retard.' : '';
                $lines[] = $chantier->name.' · fin '.$end.' · avancement '.(int) $chantier->progress.' %.'.$late;
            }
        }
        $memory = $this->recall();
        if ($memory) {
            $lines[] = $memory;
        }
        $late = $this->lateTasks();
        if ($late) {
            $lines[] = $late;
        }

        return implode("\n", $lines);
    }

    private function workPlan(): string
    {
        $steps = [];
        $n = 1;

        $late = Task::query()
            ->with('chantier')
            ->where(function ($query) {
                $query->where('status', 'en_retard')
                    ->orWhere(function ($query) {
                        $query->whereIn('status', ['a_faire', 'en_cours'])->whereDate('due_date', '<', today());
                    });
            })
            ->orderBy('due_date')
            ->limit(4)
            ->get();
        foreach ($late as $task) {
            $steps[] = $n.'. Traiter « '.$task->title.' » ('.($task->chantier?->name ?: 'sans chantier').', échéance '.($task->due_date?->format('d/m/Y') ?: 'non datée').').';
            $n++;
        }

        $open = Task::query()
            ->with('chantier')
            ->whereIn('status', ['a_faire', 'en_cours'])
            ->where(function ($query) {
                $query->whereNull('due_date')->orWhereDate('due_date', '>=', today());
            })
            ->orderBy('due_date')
            ->limit(4)
            ->get();
        foreach ($open as $task) {
            $steps[] = $n.'. Avancer « '.$task->title.' » ('.($task->chantier?->name ?: 'sans chantier').').';
            $n++;
        }

        $chantiers = Chantier::query()
            ->where('archived', false)
            ->where('status', 'en_cours')
            ->orderBy('end_date')
            ->limit(3)
            ->get();
        foreach ($chantiers as $chantier) {
            $end = $chantier->end_date?->format('d/m/Y') ?: 'sans échéance';
            $flag = $chantier->end_date && $chantier->end_date->isPast() ? ' — en retard' : '';
            $steps[] = $n.'. Suivre le chantier '.$chantier->name.' ('.(int) $chantier->progress.' %, fin '.$end.$flag.').';
            $n++;
        }

        $memory = GhitaMemory::query()
            ->when($this->user, fn ($query) => $query->where('user_id', $this->user->id))
            ->latest()
            ->limit(2)
            ->get();
        foreach ($memory as $row) {
            $steps[] = $n.'. Appliquer : '.$row->content.($row->due_on ? ' (échéance '.$row->due_on->format('d/m/Y').')' : '').'.';
            $n++;
        }

        if ($steps === []) {
            return "Plan de travail\nAucune tâche ni chantier ouvert pour l'instant. Créez une tâche ou ouvrez un chantier, puis redemandez le plan.";
        }

        array_unshift($steps, 'Plan de travail à exécuter (issu du système, pas un modèle générique) :');

        return implode("\n", $steps);
    }

    private function research(string $raw, string $q): string
    {
        $term = trim((string) preg_replace('/\b(cherche|recherche|trouve|synthese|synthetise|moi|dans|sur|les|des|une|un)\b/', ' ', $q));
        $term = trim(preg_replace('/\s+/', ' ', $term) ?? '');
        if ($term === '' || mb_strlen($term) < 2) {
            return 'Précisez le sujet. Un nom de client, de fournisseur, de chantier ou de produit.';
        }

        $like = '%'.$term.'%';
        $lines = ['Recherche « '.$raw.' ». Je résume ce qui est dans le système.'];
        $clients = Client::query()->whereRaw('LOWER(name) like ?', [$like])->limit(3)->get();
        $suppliers = Supplier::query()->whereRaw('LOWER(name) like ?', [$like])->limit(3)->get();
        $chantiers = Chantier::query()->whereRaw('LOWER(name) like ?', [$like])->limit(3)->get();
        $products = Product::query()->where(function ($query) use ($like) {
            $query->whereRaw('LOWER(name) like ?', [$like])->orWhereRaw('LOWER(reference) like ?', [$like]);
        })->limit(3)->get();
        $documents = Document::query()->where(function ($query) use ($like) {
            $query->whereRaw('LOWER(title) like ?', [$like])->orWhereRaw('LOWER(file_name) like ?', [$like]);
        })->limit(3)->get();

        if ($clients->isEmpty() && $suppliers->isEmpty() && $chantiers->isEmpty() && $products->isEmpty() && $documents->isEmpty()) {
            return 'Rien dans le système pour « '.$term.' ». Vérifiez l\'orthographe, ou donnez le code CR ou CF.';
        }
        foreach ($clients as $client) {
            $snapshot = ClientPlafond::snapshot($client);
            $lines[] = 'Client '.$client->name.' · solde '.$this->money($snapshot['solde']).'.';
        }
        foreach ($suppliers as $supplier) {
            $lines[] = 'Fournisseur '.$supplier->name.'.';
        }
        foreach ($chantiers as $chantier) {
            $lines[] = 'Chantier '.$chantier->name.' · '.(int) $chantier->progress.' %.';
        }
        foreach ($products as $product) {
            $lines[] = 'Produit '.($product->reference ?: $product->name).' · stock '.$product->quantity_in_stock.'.';
        }
        foreach ($documents as $document) {
            $lines[] = 'Document '.($document->title ?: $document->file_name).'.';
        }
        $lines[] = 'Synthèse : '.$this->researchStance($clients, $suppliers).'';

        return implode("\n", $lines);
    }

    private function documents(string $q): string
    {
        $documents = Document::query()->latest()->limit(12)->get();
        if ($documents->isEmpty()) {
            return 'Aucun document enregistré. Déposez un PDF, un Excel ou un Word dans les documents, et je le lirai.';
        }

        $needle = trim(preg_replace('/\b(document|documents|pdf|excel|word|fichier|lis|lire|analyse)\b/', ' ', $q) ?? '');
        $needle = trim(preg_replace('/\s+/', ' ', $needle) ?? '');
        $chosen = null;
        if ($needle !== '') {
            $chosen = $documents->first(function ($document) use ($needle) {
                $hay = $this->fold(($document->title ?: '').' '.($document->file_name ?: ''));

                return str_contains($hay, $needle);
            });
        }
        if (! $chosen && ($q === '' || $q === 'documents' || $q === 'document')) {
            $lines = [$documents->count().' document'.($documents->count() > 1 ? 's' : '').' au dossier.'];
            foreach ($documents->take(8) as $document) {
                $lines[] = ($document->title ?: $document->file_name).' · '.strtoupper(pathinfo((string) $document->file_name, PATHINFO_EXTENSION) ?: 'fichier');
            }
            $lines[] = 'Dites le nom du fichier pour que j\'en sorte le texte.';

            return implode("\n", $lines);
        }
        if (! $chosen) {
            $chosen = $documents->first();
        }

        return $this->readDocument($chosen);
    }

    private function automation(string $raw, string $q): array
    {
        if (preg_match('/\b(retiens|note que|decide)\b/', $q)) {
            return ['reply' => $this->memory($raw, $q)];
        }

        $chantier = $this->findChantier($q);
        $title = trim((string) preg_replace('/^.*?\b(tache|tâche)\b[:\s]*/iu', '', $raw));
        if ($title === '' || mb_strlen($title) < 3) {
            $title = 'Suivi demandé par Ghita';
        }
        if (! $chantier) {
            return ['reply' => 'Je ne crée pas la tâche sans chantier. Nommez le chantier, ou dites « retiens : » pour garder l\'objectif dans ma mémoire. Je n\'enregistre rien tant que ce n\'est pas clair.'];
        }

        return [
            'reply' => 'Je prépare la tâche « '.$title.' » sur '.$chantier->name.'. Dites oui pour que je l\'enregistre. Sans oui, je ne fais rien.',
            'pending' => [
                'action' => 'task',
                'chantier_id' => $chantier->id,
                'title' => Str::limit($title, 180, ''),
                'content' => $raw,
                'due_on' => $this->extractDate($raw),
            ],
        ];
    }

    private function readDocument(Document $document): string
    {
        $name = $document->title ?: $document->file_name;
        if (! $document->file_path || ! Storage::disk('public')->exists($document->file_path)) {
            return 'Le document « '.$name.' » est listé, le fichier n\'est pas sur le disque. Je ne peux pas l\'analyser.';
        }

        $path = Storage::disk('public')->path($document->file_path);
        $ext = strtolower(pathinfo((string) $document->file_name, PATHINFO_EXTENSION));
        $text = match ($ext) {
            'txt', 'csv', 'md' => $this->clip((string) file_get_contents($path)),
            'docx' => $this->docxText($path),
            'xlsx' => $this->xlsxText($path),
            'pdf' => $this->pdfText($path),
            default => '',
        };

        if ($text === '') {
            return 'Je vois « '.$name.' » ('.strtoupper($ext ?: 'fichier').'). Je n\'en sors pas de texte exploitable. Un Excel, un Word ou un CSV me permet une lecture directe.';
        }

        return 'Lecture de « '.$name.' ».'."\n".$text."\n".'Je m\'arrête au texte utile. Si un montant vous sert à décider, donnez-le moi et je dirai s\'il est tenable.';
    }

    private function docxText(string $path): string
    {
        $zip = new \ZipArchive;
        if ($zip->open($path) !== true) {
            return '';
        }
        $xml = $zip->getFromName('word/document.xml') ?: '';
        $zip->close();
        $xml = str_replace(['</w:p>', '</w:tr>'], "\n", $xml);

        return $this->clip(trim(html_entity_decode(strip_tags($xml))));
    }

    private function xlsxText(string $path): string
    {
        $zip = new \ZipArchive;
        if ($zip->open($path) !== true) {
            return '';
        }
        $xml = $zip->getFromName('xl/sharedStrings.xml') ?: '';
        $zip->close();
        $xml = str_replace('</si>', "\n", $xml);

        return $this->clip(trim(html_entity_decode(strip_tags($xml))));
    }

    private function pdfText(string $path): string
    {
        $raw = (string) file_get_contents($path);
        if (! preg_match_all('/\((?:\\\\\)|[^)]){3,}\)/', $raw, $matches)) {
            return '';
        }
        $parts = array_map(fn ($piece) => stripcslashes(substr($piece, 1, -1)), $matches[0]);

        return $this->clip(trim(implode(' ', $parts)));
    }

    private function lateTasks(): string
    {
        $tasks = Task::query()
            ->with('chantier')
            ->where(function ($query) {
                $query->where('status', 'en_retard')
                    ->orWhere(function ($query) {
                        $query->whereIn('status', ['a_faire', 'en_cours'])->whereDate('due_date', '<', today());
                    });
            })
            ->orderBy('due_date')
            ->limit(6)
            ->get();
        if ($tasks->isEmpty()) {
            return '';
        }
        $lines = [$tasks->count().' tâche'.($tasks->count() > 1 ? 's' : '').' en retard.'];
        foreach ($tasks as $task) {
            $lines[] = $task->title.' · '.($task->chantier?->name ?: 'chantier').' · '.($task->due_date?->format('d/m/Y') ?: 'sans date').'.';
        }

        return implode("\n", $lines);
    }

    private function recall(): string
    {
        $rows = GhitaMemory::query()
            ->when($this->user, fn ($query) => $query->where('user_id', $this->user->id))
            ->latest()
            ->limit(8)
            ->get();
        if ($rows->isEmpty()) {
            return '';
        }
        $lines = ['Voici ce que je retiens.'];
        foreach ($rows as $row) {
            $due = $row->due_on ? ' · échéance '.$row->due_on->format('d/m/Y') : '';
            $lines[] = $this->kindLabel($row->kind).' : '.$row->content.$due.'.';
        }

        return implode("\n", $lines);
    }

    private function store(string $kind, string $content, ?string $due): void
    {
        GhitaMemory::create([
            'user_id' => $this->user?->id,
            'kind' => in_array($kind, ['projet', 'objectif', 'decision'], true) ? $kind : 'decision',
            'title' => Str::limit($content, 120, ''),
            'content' => $content,
            'due_on' => $due,
        ]);
    }

    private function findClient(string $q): ?Client
    {
        $best = null;
        $score = 0;
        foreach (Client::query()->get() as $client) {
            $name = $this->fold((string) $client->name);
            foreach ($this->tokens($q) as $token) {
                if (str_contains($name, $token) && mb_strlen($token) > $score) {
                    $best = $client;
                    $score = mb_strlen($token);
                }
            }
        }

        return $best;
    }

    private function findChantier(string $q): ?Chantier
    {
        $best = null;
        $score = 0;
        foreach (Chantier::query()->where('archived', false)->get() as $chantier) {
            $name = $this->fold((string) $chantier->name);
            if ($name !== '' && str_contains($q, $name) && mb_strlen($name) > $score) {
                $best = $chantier;
                $score = mb_strlen($name);
                continue;
            }
            foreach ($this->tokens($q) as $token) {
                if (str_contains($name, $token) && mb_strlen($token) > $score) {
                    $best = $chantier;
                    $score = mb_strlen($token);
                }
            }
        }

        return $best;
    }

    private function researchStance($clients, $suppliers): string
    {
        if ($clients->isNotEmpty() && $suppliers->isEmpty()) {
            return 'c\'est un client. Regardez le solde avant d\'accorder une commande.';
        }
        if ($suppliers->isNotEmpty() && $clients->isEmpty()) {
            return 'c\'est un fournisseur. Vérifiez le reste à décaisser avant de commander.';
        }
        if ($clients->isNotEmpty() && $suppliers->isNotEmpty()) {
            return 'le nom existe des deux côtés. Précisez client ou fournisseur avant de décider.';
        }

        return 'aucun compte client ou fournisseur direct. Croisez avec le chantier avant d\'engager une dépense.';
    }

    private function tokens(string $q): array
    {
        preg_match_all('/[a-z0-9]{4,}/', $q, $matches);
        $stop = ['cherche', 'recherche', 'client', 'fournisseur', 'chantier', 'projet', 'solde', 'veux', 'encore', 'acheter', 'commande', 'document', 'analyse', 'tache', 'creer'];

        return array_values(array_filter($matches[0] ?? [], fn ($token) => ! in_array($token, $stop, true)));
    }

    private function extractAmount(string $raw): ?float
    {
        if (! preg_match('/(\d{1,3}(?:[ \x{00A0}.]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/u', $raw, $matches)) {
            return null;
        }
        $token = str_replace(["\u{00A0}", ' '], '', $matches[1]);
        if (str_contains($token, ',')) {
            $token = str_replace('.', '', $token);
            $token = str_replace(',', '.', $token);
        } elseif (preg_match('/^\d{1,3}(?:\.\d{3})+$/', $token)) {
            $token = str_replace('.', '', $token);
        }

        return round((float) $token, 2);
    }

    private function extractDate(string $raw): ?string
    {
        if (preg_match('/(\d{1,2})\/(\d{1,2})\/(\d{4})/', $raw, $matches)) {
            return sprintf('%04d-%02d-%02d', $matches[3], $matches[2], $matches[1]);
        }
        if (preg_match('/(\d{1,2})\/(\d{1,2})(?!\d)/', $raw, $matches)) {
            return sprintf('%04d-%02d-%02d', (int) now()->year, $matches[2], $matches[1]);
        }

        return null;
    }

    private function kindLabel(string $kind): string
    {
        return match ($kind) {
            'projet' => 'Projet',
            'objectif' => 'Objectif',
            default => 'Décision',
        };
    }

    private function clip(string $text): string
    {
        $text = trim(preg_replace("/[ \t]+/", ' ', $text) ?? '');
        $text = trim(preg_replace("/\n{2,}/", "\n", $text) ?? '');
        if ($text === '') {
            return '';
        }

        return Str::limit($text, 700, '…');
    }

    private function money(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ');
    }

    private function fold(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = strtr($value, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ä' => 'a',
            'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ô' => 'o', 'ö' => 'o',
            'î' => 'i', 'ï' => 'i',
            'ç' => 'c',
        ]);

        return preg_replace('/\s+/', ' ', $value) ?? $value;
    }
}
