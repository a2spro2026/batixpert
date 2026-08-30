<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientInvoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoicePaymentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_payment_updates_only_the_linked_invoice(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = Client::create(['name' => 'Client Test', 'status' => 'actif']);
        $invoice = ClientInvoice::create([
            'client_id' => $client->id,
            'reference' => 'FV-TEST-001',
            'invoice_date' => '2026-08-14',
            'total_ht' => 1000,
            'tva' => 200,
            'total_ttc' => 1200,
            'amount_paid' => 0,
            'status' => 'en_attente',
        ]);

        $response = $this->postJson('/api/invoice-payments', [
            'invoice_id' => $invoice->id,
            'payment_date' => '2026-08-14',
            'amount' => 400,
            'method' => 'virement',
            'reference' => 'VIR-001',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.invoice_reference', 'FV-TEST-001')
            ->assertJsonPath('data.amount', '400.00');

        $this->assertDatabaseHas('payments', [
            'type' => 'client',
            'payable_type' => ClientInvoice::class,
            'payable_id' => $invoice->id,
            'amount' => 400,
        ]);
        $this->assertDatabaseCount('client_payments', 0);
        $this->assertSame('400.00', $invoice->fresh()->amount_paid);
        $this->assertSame('partielle', $invoice->fresh()->status);
    }

    public function test_deleting_invoice_payment_restores_invoice_balance(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $client = Client::create(['name' => 'Client Test', 'status' => 'actif']);
        $invoice = ClientInvoice::create([
            'client_id' => $client->id,
            'reference' => 'FV-TEST-002',
            'invoice_date' => '2026-08-14',
            'total_ht' => 500,
            'tva' => 100,
            'total_ttc' => 600,
            'amount_paid' => 600,
            'status' => 'payee',
        ]);
        $payment = Payment::create([
            'type' => 'client',
            'payable_type' => ClientInvoice::class,
            'payable_id' => $invoice->id,
            'amount' => 600,
            'payment_date' => '2026-08-14',
            'method' => 'especes',
            'user_id' => $user->id,
        ]);

        $this->deleteJson("/api/invoice-payments/{$payment->id}")
            ->assertOk();

        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
        $this->assertSame('0.00', $invoice->fresh()->amount_paid);
        $this->assertSame('en_attente', $invoice->fresh()->status);
    }
}
