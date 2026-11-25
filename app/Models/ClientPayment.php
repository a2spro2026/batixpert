<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientPayment extends Model
{
    protected $fillable = [
        'reference', 'payment_date', 'client_id', 'client_name', 'ville_chantier',
        'chantier_type', 'montant_total', 'reglement', 'numero', 'banque', 'nom_tire',
        'montant', 'tresorerie', 'date_decaissement', 'remarque', 'solde', 'statut', 'user_id',
        'endosse_supplier_payment_id',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'date_decaissement' => 'date',
            'montant_total' => 'decimal:2',
            'montant' => 'decimal:2',
            'solde' => 'decimal:2',
        ];
    }

    public function scopeForPortalTreasuries($query, ?array $names)
    {
        if ($names === null) {
            return $query;
        }

        $names = collect($names)
            ->map(fn ($name) => mb_strtoupper(trim((string) $name)))
            ->filter()
            ->unique()
            ->values();

        if ($names->isEmpty()) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($inner) use ($names) {
            foreach ($names as $name) {
                $inner->orWhereRaw('UPPER(tresorerie) = ?', [$name]);
            }
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(ClientPaymentAllocation::class);
    }

    public function endosseSupplierPayment(): BelongsTo
    {
        return $this->belongsTo(SupplierPayment::class, 'endosse_supplier_payment_id');
    }
}
