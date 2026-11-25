<?php

namespace App\Support;

use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientPayment;
use App\Models\SaleOrder;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ClientPlafond
{
    public static function solde(int $clientId, ?int $exceptSaleOrderId = null, ?int $exceptClientOrderId = null): float
    {
        $sales = (float) SaleOrder::query()
            ->where('client_id', $clientId)
            ->where('status', '!=', 'annule')
            ->when($exceptSaleOrderId, fn ($q) => $q->where('id', '!=', $exceptSaleOrderId))
            ->sum('total_ttc');

        $orders = (float) ClientOrder::query()
            ->where('client_id', $clientId)
            ->where('status', '!=', 'annule')
            ->when($exceptClientOrderId, fn ($q) => $q->where('id', '!=', $exceptClientOrderId))
            ->sum('total_ttc');

        $paid = (float) ClientPayment::query()
            ->where('client_id', $clientId)
            ->sum('montant');

        return round(max($sales + $orders - $paid, 0), 2);
    }

    public static function snapshot(Client $client, ?int $exceptSaleOrderId = null, ?int $exceptClientOrderId = null): array
    {
        $solde = self::solde($client->id, $exceptSaleOrderId, $exceptClientOrderId);
        $plafond = $client->plafond === null ? null : round((float) $client->plafond, 2);

        return [
            'plafond' => $plafond,
            'solde' => $solde,
            'reste' => $plafond === null ? null : round($plafond - $solde, 2),
        ];
    }

    public static function assert(Client $client, float $orderAmount, ?User $user, bool $authorize, ?int $exceptSaleOrderId = null, ?int $exceptClientOrderId = null): void
    {
        if ($client->plafond === null) {
            return;
        }

        $snapshot = self::snapshot($client, $exceptSaleOrderId, $exceptClientOrderId);
        $reste = (float) $snapshot['reste'];
        if (round($orderAmount, 2) <= round($reste, 2) + 0.001) {
            return;
        }

        $disponible = number_format(max($reste, 0), 2, ',', ' ');
        $isAdmin = $user && ($user->statut === 'Gerant' || $user->isAdmin());

        if ($isAdmin && $authorize) {
            return;
        }

        $message = $isAdmin
            ? "Plafond dépassé. Reste disponible : {$disponible}. L'admin doit autoriser ce dépassement."
            : "Plafond dépassé. Reste disponible : {$disponible}. Voir l'admin.";

        throw ValidationException::withMessages([
            'plafond' => [$message],
        ]);
    }
}
