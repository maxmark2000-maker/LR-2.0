import React, { useEffect, useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Card, CardContent } from '@/components/ui/card';
import RefereeCreateForm from '@/components/orga/RefereeCreateForm';
import RefereeAccountsTable from '@/components/orga/RefereeAccountsTable';

export default function RefereeAdmin({ competitions }) {
  const [referees, setReferees] = useState([]);

  const load = async () => {
    const all = await orga.entities.Referee.list('-created_date');
    all.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' }));
    setReferees(all);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-heading text-xl font-bold">Referee accounts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          All provisioned LiveRefereeing users. Search and filter the list, and open a referee to edit the account, function and competition assignments.
        </p>

        <div className="mt-6">
          <RefereeCreateForm onCreated={load} />
        </div>

        <div className="mt-6">
          <RefereeAccountsTable referees={referees} competitions={competitions} onChanged={load} />
        </div>
      </CardContent>
    </Card>
  );
}