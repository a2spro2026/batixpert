<?php

namespace App\Support\Ghita;

use App\Models\Client;
use App\Models\ClientInvoice;
use App\Models\ClientOrder;
use App\Models\ClientPayment;
use App\Models\ClientRelance;
use App\Models\PurchaseOrder;
use App\Models\SaleOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Support\ClientPlafond;

class GhitaDossier
{
    public function client(Client $client): array
    {
        $snap = ClientPlafond::snapshot($client);
        $sales = SaleOrder::query()->where('client_id', $client->id)->where('status', '!=', 'annule');
        $salesTotal = round((float) (clone $sales)->sum('total_ttc'), 2);
        $salesOpen = round((float) (clone $sales)->whereRaw('ROUND(total_ttc - COALESCE(montant_paye, 0), 2) > 0.009')->count(), 2);
        $ordersTotal = round((float) ClientOrder::query()->where('client_id', $client->id)->where('status', '!=', 'annule')->sum('total_ttc'), 2);
        $paid = round((float) ClientPayment::query()->where('client_id', $client->id)->sum('montant'), 2);
        $payments = ClientPayment::query()->where('client_id', $client->id)->orderByDesc('payment_date')->limit(3)->get();
        $invoices = ClientInvoice::query()->where('client_id', $client->id)->get();
        $unpaid = $invoices->filter(function (ClientInvoice $invoice) {
            return in_array($invoice->status, ['en_attente', 'partielle', 'en_retard'], true)
                && $invoice->remainingAmount() > 0.009;
        });
        $invoiceDue = round($unpaid->sum(fn (ClientInvoice $invoice) => $invoice->remainingAmount()), 2);
        $relances = ClientRelance::query()->where('client_id', $client->id)->orderByDesc('date_rappel')->get();
        $dueRelances = $relances->filter(fn (ClientRelance $row) => $row->date_rappel && $row->date_rappel->lte(today()));

        return [
            'name' => $client->name,
            'code' => $client->code,
            'status' => $client->status ?: 'actif',
            'plafond' => $snap['plafond'],
            'encours' => (float) $snap['solde'],
            'reste' => $snap['reste'],
            'sales_total' => $salesTotal,
            'sales_open' => (int) $salesOpen,
            'orders_total' => $ordersTotal,
            'paid' => $paid,
            'payments' => $payments,
            'invoices' => $invoices->count(),
            'invoices_unpaid' => $unpaid->count(),
            'invoices_due' => $invoiceDue,
            'relances' => $relances->count(),
            'relances_due' => $dueRelances->count(),
            'next_relance' => $relances->first()?->date_rappel,
        ];
    }

    public function supplier(Supplier $supplier): array
    {
        $orders = PurchaseOrder::query()->where('supplier_id', $supplier->id)->where('status', '!=', 'annule');
        $achats = round((float) (clone $orders)->sum('total_ttc'), 2);
        $open = (clone $orders)->get()->filter(fn (PurchaseOrder $order) => ((float) $order->total_ttc - (float) $order->montant_paye) > 0.009);
        $paid = round((float) SupplierPayment::query()->where('supplier_id', $supplier->id)->sum('montant'), 2);
        $payments = SupplierPayment::query()->where('supplier_id', $supplier->id)->orderByDesc('payment_date')->limit(3)->get();
        $reste = round($open->sum(fn (PurchaseOrder $order) => max((float) $order->total_ttc - (float) $order->montant_paye, 0)), 2);

        return [
            'name' => $supplier->name,
            'code' => $supplier->code,
            'achats' => $achats,
            'open' => $open->count(),
            'reste' => $reste,
            'paid' => $paid,
            'payments' => $payments,
            'last_order' => (clone $orders)->orderByDesc('order_date')->first(),
        ];
    }

    public function readClient(Client $client, string $focus = 'situation'): string
    {
        $row = $this->client($client);
        $lines = [$row['name'].' · '.$row['code'].'.'];

        if ($focus === 'invoices') {
            $lines[] = $this->invoiceLine($row);
            $lines[] = 'Encours des bons : '.$this->money($row['encours']).' DH. Les factures ne sont pas additionnées à cet encours.';
        } elseif ($focus === 'payments') {
            $lines[] = $this->paymentLine($row);
            if ($row['paid'] > 0.009) {
                $lines[] = 'Ces règlements réduisent l\'encours. Encours restant : '.$this->money($row['encours']).' DH.';
            }
        } elseif ($focus === 'history') {
            $lines[] = $this->historyLine($row);
        } else {
            $lines[] = 'Encours : '.$this->money($row['encours']).' DH. Calcul : bons de vente '.$this->money($row['sales_total']).' DH + commandes '.$this->money($row['orders_total']).' DH − règlements '.$this->money($row['paid']).' DH.';
            $lines[] = $this->creditLine($row);
            $lines[] = $this->invoiceLine($row);
            $lines[] = $this->paymentLine($row);
            $lines[] = $this->historyLine($row);
        }

        $lines[] = $this->clientAdvice($row);

        return implode("\n", $lines);
    }

    public function readSupplier(Supplier $supplier, string $focus = 'situation'): string
    {
        $row = $this->supplier($supplier);
        $lines = [$row['name'].' · '.$row['code'].'.'];

        if ($focus === 'payments') {
            $lines[] = 'Règlements fournisseur : '.$this->money($row['paid']).' DH.';
            $lines[] = ($row['paid'] > 0.009 ? 'Ils réduisent la dette des bons. ' : 'Aucun règlement ne réduit encore la dette. ').'Reste à décaisser : '.$this->money($row['reste']).' DH.';
        } else {
            $lines[] = 'Achats non annulés : '.$this->money($row['achats']).' DH. Réglé : '.$this->money($row['paid']).' DH. Reste à décaisser : '.$this->money($row['reste']).' DH, sur '.$row['open'].' bon'.($row['open'] > 1 ? 's' : '').' non soldé'.($row['open'] > 1 ? 's' : '').'.';
            if ($row['last_order']) {
                $lines[] = 'Dernier bon : '.($row['last_order']->reference ?: 'sans référence').' · '.optional($row['last_order']->order_date)->format('d/m/Y').'.';
            }
            $lines[] = 'Cette dette vient des bons d\'achat. Elle n\'est pas une facture fournisseur.';
        }

        if ($row['reste'] > 0.009) {
            $lines[] = 'Lecture : ne pas ajouter d\'achat tant que ces '.$this->money($row['reste']).' DH ne sont pas arbitrés.';
        } else {
            $lines[] = 'Lecture : aucun reste à décaisser sur ses bons.';
        }

        return implode("\n", $lines);
    }

    private function creditLine(array $row): string
    {
        if ($row['plafond'] === null) {
            return 'Aucun plafond enregistré. Je n\'en invente pas. Une nouvelle vente n\'est pas bloquée par le crédit.';
        }

        $line = 'Plafond : '.$this->money($row['plafond']).' DH. Reste disponible : '.$this->money($row['reste']).' DH.';
        if ($row['encours'] > (float) $row['plafond'] + 0.001) {
            $line .= ' Le plafond est dépassé. Seul le gérant peut autoriser une vente en plus.';
        }

        return $line;
    }

    private function invoiceLine(array $row): string
    {
        if ($row['invoices'] === 0) {
            return 'Factures client : aucune.';
        }

        if ($row['invoices_unpaid'] === 0) {
            return $row['invoices'].' facture'.($row['invoices'] > 1 ? 's' : '').', aucune impayée.';
        }

        return $row['invoices_unpaid'].' facture'.($row['invoices_unpaid'] > 1 ? 's' : '').' impayée'.($row['invoices_unpaid'] > 1 ? 's' : '').', reste '.$this->money($row['invoices_due']).' DH. Ce reste n\'est pas l\'encours des bons.';
    }

    private function paymentLine(array $row): string
    {
        if ($row['payments']->isEmpty()) {
            return 'Règlements clients : aucun. L\'encours n\'est réduit par aucun paiement.';
        }

        $last = $row['payments']->map(function (ClientPayment $payment) {
            return optional($payment->payment_date)->format('d/m/Y').' · '.$this->money($payment->montant).' DH';
        })->implode(' ; ');

        return 'Règlements clients : '.$this->money($row['paid']).' DH. Derniers : '.$last.'.';
    }

    private function historyLine(array $row): string
    {
        $bits = [];
        if ($row['sales_open'] > 0) {
            $bits[] = $row['sales_open'].' bon'.($row['sales_open'] > 1 ? 's' : '').' de vente non soldé'.($row['sales_open'] > 1 ? 's' : '');
        } else {
            $bits[] = 'aucun bon de vente ouvert';
        }
        if ($row['relances_due'] > 0) {
            $bits[] = $row['relances_due'].' relance'.($row['relances_due'] > 1 ? 's' : '').' due'.($row['relances_due'] > 1 ? 's' : '');
        } elseif ($row['next_relance']) {
            $bits[] = 'prochain rappel le '.$row['next_relance']->format('d/m/Y');
        } else {
            $bits[] = 'aucune relance';
        }

        return 'Historique : '.implode(', ', $bits).'.';
    }

    private function clientAdvice(array $row): string
    {
        if ($row['encours'] <= 0.009 && $row['invoices_due'] <= 0.009 && $row['sales_open'] === 0) {
            $line = 'Lecture : rien à encaisser. Factures, bons et règlements racontent la même chose.';
            if ($row['plafond'] === null) {
                $line .= ' Sans plafond, un nouveau bon n\'est pas bloqué.';
            }

            return $line;
        }

        if ($row['invoices_due'] > 0.009 && $row['encours'] <= 0.009) {
            return 'Lecture : l\'impayé est sur les factures ('.$this->money($row['invoices_due']).' DH), pas sur les bons. Relancer la facture, pas un bon déjà soldé.';
        }

        if ($row['encours'] > 0.009 && $row['invoices_due'] <= 0.009) {
            return 'Lecture : l\'encours de '.$this->money($row['encours']).' DH vient des bons, pas des factures. C\'est ce montant qui consomme le plafond.';
        }

        return 'Lecture : deux restes distincts. Encours des bons '.$this->money($row['encours']).' DH, factures impayées '.$this->money($row['invoices_due']).' DH. Ne pas les additionner.';
    }

    private function money(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ');
    }
}
