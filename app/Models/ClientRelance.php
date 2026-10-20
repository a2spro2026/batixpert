<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientRelance extends Model
{
    protected $fillable = [
        'client_id', 'client_name', 'date_appel', 'remarque', 'date_rappel', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'date_appel' => 'date',
            'date_rappel' => 'date',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
