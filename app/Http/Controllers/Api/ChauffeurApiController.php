<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use Illuminate\Support\Str;

class ChauffeurApiController extends Controller
{
    public function index()
    {
        $orders = PurchaseOrder::query()
            ->whereNotNull('chauffeur')
            ->where('chauffeur', '!=', '')
            ->orderByDesc('id')
            ->get(['chauffeur', 'matricule']);

        $byName = [];
        $usedMatricules = [];

        foreach ($orders as $order) {
            $nom = $this->normalizeDisplay((string) $order->chauffeur);
            if ($nom === '') {
                continue;
            }

            $nameKey = $this->normalizeKey($nom);
            if (isset($byName[$nameKey])) {
                continue;
            }

            $matricule = $this->normalizeDisplay((string) ($order->matricule ?? ''));
            $matKey = $matricule !== '' ? $this->normalizeKey($matricule) : null;

            // Un même matricule ne doit apparaître qu'une seule fois (lié au chauffeur le plus récent).
            if ($matKey !== null && isset($usedMatricules[$matKey])) {
                $matricule = null;
                $matKey = null;
            }

            if ($matKey !== null) {
                $usedMatricules[$matKey] = true;
            }

            $byName[$nameKey] = [
                'nom' => $nom,
                'matricule' => $matricule !== '' ? $matricule : null,
            ];
        }

        uasort($byName, fn ($a, $b) => strcasecmp($a['nom'], $b['nom']));

        $data = collect($byName)
            ->values()
            ->map(fn (array $item, int $index) => [
                'id' => $index + 1,
                'nom' => $item['nom'],
                'matricule' => $item['matricule'],
            ])
            ->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'total' => count($data),
            ],
        ]);
    }

    private function normalizeDisplay(string $value): string
    {
        return trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    }

    private function normalizeKey(string $value): string
    {
        return Str::upper($this->normalizeDisplay($value));
    }
}
