import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChantiersPage from './pages/ChantiersPage';
import BonAchatsPage from './pages/BonAchatsPage';
import BonVentesPage from './pages/BonVentesPage';
import FicheProduitPage from './pages/FicheProduitPage';
import GenericListPage from './pages/GenericListPage';
import ModulePage from './pages/ModulePage';
import FicheFournisseurPage from './pages/FicheFournisseurPage';
import FicheClientPage from './pages/FicheClientPage';
import BonExecutionListPage from './pages/clients/BonExecutionListPage';
import ClientBalancePage from './pages/clients/ClientBalancePage';
import EtatPaiementPage from './pages/clients/EtatPaiementPage';
import DevisListPage from './pages/devis/DevisListPage';
import DevisFormPage from './pages/devis/DevisFormPage';
import TransactionsPage from './pages/TransactionsPage';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="w-10 h-10 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

const employeeCols = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'name', label: 'Nom', render: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'position', label: 'Poste' },
    { key: 'monthly_salary', label: 'Salaire', render: (r) => `${r.monthly_salary}` },
    { key: 'status', label: 'Statut' },
];

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />

                {/* Fournisseur */}
                <Route path="fournisseurs/fiches" element={<FicheFournisseurPage />} />
                <Route path="fournisseurs/bons-achats" element={<BonAchatsPage />} />
                <Route path="fournisseurs/reglements-achats" element={<ModulePage />} />
                <Route path="fournisseurs/factures-achats" element={<ModulePage />} />
                <Route path="fournisseurs/reglements-factures" element={<ModulePage />} />
                <Route path="fournisseurs/balance" element={<ModulePage />} />
                <Route path="fournisseurs/releve-compte" element={<ModulePage />} />

                {/* Client */}
                <Route path="clients/fiches" element={<FicheClientPage />} />
                <Route path="clients/bons-de-vente" element={<BonVentesPage />} />
                <Route path="clients/devis/nouveau" element={<DevisFormPage />} />
                <Route path="clients/devis/:id" element={<DevisFormPage />} />
                <Route path="clients/devis" element={<DevisListPage />} />
                <Route path="clients/bons-vente" element={<BonExecutionListPage />} />
                <Route path="clients/reglements-vente" element={<EtatPaiementPage />} />
                <Route path="clients/factures-ventes" element={<ModulePage />} />
                <Route path="clients/reglements-factures" element={<ModulePage />} />
                <Route path="clients/balance" element={<ClientBalancePage />} />
                <Route path="clients/releve-compte" element={<ModulePage />} />

                {/* Stock */}
                <Route path="stock/produits" element={<FicheProduitPage />} />
                <Route path="stock/mouvements" element={<ModulePage />} />
                <Route path="stock/fiscal" element={<ModulePage />} />

                {/* Chantiers */}
                <Route path="chantiers/carte" element={<ChantiersPage />} />
                <Route path="chantiers/bons-commande" element={<ModulePage />} />
                <Route path="chantiers/suivi-depenses" element={<ModulePage />} />

                {/* Personnel */}
                <Route path="personnel/fiches" element={<GenericListPage title="Fiche Personnel" subtitle="Gestion des employés" endpoint="/employees" columns={employeeCols} />} />
                <Route path="personnel/etat-paiement" element={<ModulePage />} />

                {/* Suivi Monétaire */}
                <Route path="monetaire/transactions" element={<TransactionsPage />} />
                <Route path="monetaire/salaires" element={<ModulePage />} />
                <Route path="monetaire/tresorerie" element={<ModulePage />} />

                {/* Configuration */}
                <Route path="configuration/utilisateurs" element={<ModulePage />} />

                {/* Redirections anciennes routes */}
                <Route path="chantiers" element={<Navigate to="/chantiers/carte" replace />} />
                <Route path="achats" element={<Navigate to="/fournisseurs/bons-achats" replace />} />
                <Route path="stock" element={<Navigate to="/stock/produits" replace />} />
                <Route path="fournisseurs" element={<Navigate to="/fournisseurs/fiches" replace />} />
                <Route path="clients" element={<Navigate to="/clients/fiches" replace />} />
                <Route path="personnel" element={<Navigate to="/personnel/fiches" replace />} />
                <Route path="paiements" element={<Navigate to="/monetaire/tresorerie" replace />} />
                <Route path="parametres" element={<Navigate to="/configuration/utilisateurs" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter basename="/app">
                    <AppRoutes />
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}
