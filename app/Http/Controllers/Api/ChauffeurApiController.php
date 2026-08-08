<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use Illuminate\Support\Str;

class ChauffeurApiController extends Controller
{
    public function index()
    {
        $rows = PurchaseOrder::query()
            ->whereNotNull('chauffeur')
            ->where('chauffeur', '!=', '')
            ->orderBy('chauffeur')
            ->get(['chauffeur', 'matricule']);

        $grouped = [];

        foreach ($rows as $row) {
            $nom = trim((string) $row->chauffeur);
            if ($nom === '') {
                continue;
            }

            $key = Str::upper($nom);
            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'nom' => $nom,
                    'matricules' => [],
                ];
            }

            $matricule = trim((string) ($row->matricule ?? ''));
            if ($matricule !== '') {
                $matKey = Str::upper($matricule);
                if (! isset($grouped[$key]['matricules'][$matKey])) {
                    $grouped[$key]['matricules'][$matKey] = $matricule;
                }
            }
        }

        uasort($grouped, fn ($a, $b) => strcasecmp($a['nom'], $b['nom']));

        $data = collect($grouped)
            ->values()
            ->map(function (array $item, int $index) {
                return [
                    'id' => $index + 1,
                    'nom' => $item['nom'],
                    'matricule' => implode(', ', array_values($item['matricules'])) ?: null,
                ];
            })
            ->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'total' => count($data),
            ],
        ]);
    }
}
