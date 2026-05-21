import ConvergenceFlow from '@/components/convergence/ConvergenceFlow';
import HydrationGate from '@/components/HydrationGate';

export default function ConvergePage() {
  return (
    <HydrationGate>
      <ConvergenceFlow />
    </HydrationGate>
  );
}
