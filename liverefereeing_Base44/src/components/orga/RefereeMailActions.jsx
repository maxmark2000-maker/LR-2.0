import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail } from 'lucide-react';
import { buildCredentialMail } from '@/lib/refereeMail';
import CopyField from '@/components/orga/CopyField';

export default function RefereeMailActions({ credentials, disabled = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const { subject, body } = buildCredentialMail(credentials);

  return (
    <div className={className}>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Mail className="w-4 h-4 mr-1" /> Template to send
      </Button>
      {disabled && (
        <p className="mt-1 text-xs text-muted-foreground">Set a password first — the mail contains the credentials.</p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Template to send</DialogTitle>
            <DialogDescription>
              Copy the subject and message into your email to {credentials.displayName || 'the referee'}.
            </DialogDescription>
          </DialogHeader>
          <CopyField label="Subject" value={subject} />
          <CopyField label="Message" value={body} multiline />
        </DialogContent>
      </Dialog>
    </div>
  );
}