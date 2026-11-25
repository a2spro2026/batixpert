<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Client extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'contact_person', 'email', 'phone', 'portal_login', 'portal_password', 'portal_enabled', 'portal_permissions', 'portal_tresoreries',
        'address', 'city', 'ice', 'status', 'notes',
        'chantier_type', 'reglement', 'chantier_address', 'budget', 'plafond', 'work_delay',
    ];

    protected $hidden = [
        'portal_password',
    ];

    protected function casts(): array
    {
        return [
            'budget' => 'decimal:2',
            'plafond' => 'decimal:2',
            'portal_enabled' => 'boolean',
            'portal_permissions' => 'array',
            'portal_tresoreries' => 'array',
        ];
    }

    public function getAuthPassword()
    {
        return $this->portal_password;
    }

    public function getCodeAttribute(): string
    {
        return 'CR-'.str_pad((string) $this->id, 4, '0', STR_PAD_LEFT);
    }

    public function chantiers(): HasMany
    {
        return $this->hasMany(Chantier::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(ClientInvoice::class);
    }

    public function relances(): HasMany
    {
        return $this->hasMany(ClientRelance::class);
    }

    public function saleOrders(): HasMany
    {
        return $this->hasMany(SaleOrder::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ClientPayment::class);
    }

    public static function normalizePhone(?string $phone): string
    {
        return preg_replace('/\D+/', '', (string) $phone) ?? '';
    }

    public function portalAllows(string $slug): bool
    {
        return in_array($slug, $this->portal_permissions ?? [], true);
    }

    /**
     * null = aucune limite (accès créé avant le choix des trésoreries).
     * tableau = seules ces trésoreries sont visibles.
     *
     * @return array<int, string>|null
     */
    public function portalTreasuryFilter(): ?array
    {
        if (! is_array($this->portal_tresoreries)) {
            return null;
        }

        return collect($this->portal_tresoreries)
            ->map(fn ($name) => mb_strtoupper(trim((string) $name)))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function seesTreasury(?string $name): bool
    {
        $allowed = $this->portalTreasuryFilter();
        if ($allowed === null) {
            return true;
        }

        $needle = mb_strtoupper(trim((string) $name));

        return $needle !== '' && in_array($needle, $allowed, true);
    }

    public function phoneMatches(string $input): bool
    {
        $stored = self::normalizePhone($this->phone);
        $given = self::normalizePhone($input);

        return $stored !== '' && $given !== '' && $stored === $given;
    }
}
