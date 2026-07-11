import { useState, useEffect } from 'react';
import { addPlan, getPlans } from './db';
import { Plan } from './types';
import { GanttView } from './components/GanttView';
import { uuid } from './utils/uuid';

function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Init: if no plans exist, create a default one
  useEffect(() => {
    (async () => {
      let list = await getPlans();
      if (list.length === 0) {
        const nowTs = new Date().toISOString();
        await addPlan({ id: uuid(), name: '默认计划', createdAt: nowTs });
        list = await getPlans();
      }
      setPlans(list);
      setCurrentPlanId(list[0].id);
      setLoaded(true);
    })();
  }, []);

  const handleSwitchPlan = (planId: string) => {
    setCurrentPlanId(planId);
  };

  const handlePlansChanged = async () => {
    const list = await getPlans();
    setPlans(list);
    // If the current plan was deleted, switch to first plan
    if (currentPlanId && !list.find(p => p.id === currentPlanId)) {
      if (list.length > 0) {
        setCurrentPlanId(list[0].id);
      } else {
        // All plans deleted — create a new default
        const nowTs = new Date().toISOString();
        const id = uuid();
        await addPlan({ id, name: '默认计划', createdAt: nowTs });
        const newList = await getPlans();
        setPlans(newList);
        setCurrentPlanId(id);
      }
    }
  };

  if (!loaded || !currentPlanId) return null;

  return (
    <GanttView
      key={currentPlanId}
      planId={currentPlanId}
      plans={plans}
      onSwitchPlan={handleSwitchPlan}
      onPlansChanged={handlePlansChanged}
    />
  );
}

export default App;
