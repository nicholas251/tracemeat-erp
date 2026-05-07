import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductionFlows from './pages/ProductionFlows';
import Batches from './pages/Batches';
import HoldRelease from './pages/HoldRelease';
import Traceability from './pages/Traceability';
import RawMaterials from './pages/RawMaterials';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import Receiving from './pages/Receiving';
import Recipes from './pages/Recipes';
import ProductionOrders from './pages/ProductionOrders';
import SpiceMixes from './pages/SpiceMixes';
import RawInventory from './pages/RawInventory';
import Suppliers from './pages/Suppliers';
import FlowBuilder from './pages/FlowBuilder';
import WorkProfiles from './pages/WorkProfiles';
import FloorView from './pages/FloorView';
import MyWork from './pages/MyWork';
import UserManagement from './pages/UserManagement';
import ProfileCreation from './pages/ProfileCreation';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/flows" element={<ProductionFlows />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/hold-release" element={<HoldRelease />} />
        <Route path="/traceability" element={<Traceability />} />
        <Route path="/raw-materials" element={<RawMaterials />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/receiving" element={<Receiving />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/production-orders" element={<ProductionOrders />} />
        <Route path="/spice-mixes" element={<SpiceMixes />} />
        <Route path="/raw-inventory" element={<RawInventory />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/flow-builder" element={<FlowBuilder />} />
        <Route path="/work-profiles" element={<WorkProfiles />} />
        <Route path="/floor-view" element={<FloorView />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/user-management" element={<UserManagement />} />
      </Route>
      <Route path="/signup" element={<ProfileCreation />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App