<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Client extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'contact_person', 'email', 'phone', 'portal_login', 'portal_password', 'portal_enabled', 'portal_permissions',
        'address', 'city', 'ice', 'status', 'notes',
        'chantier_type', 'reglement', 'chantier_address', 'budget', 'work_delay',
    ];

    protected $hidden = [
        'portal_password',
    ];

    protected function casts(): array
    {
        return [
            'budget' => 'decimal:2',
            'portal_enabled' => 'boolean',
            'portal_permissions' => 'array',
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

    public function phoneMatches(string $input): bool
    {
        $stored = self::normalizePhone($this->phone);
        $given = self::normalizePhone($input);

        return $stored !== '' && $given !== '' && $stored === $given;
    }
}
