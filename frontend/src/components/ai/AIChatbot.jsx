import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 rounded-full w-12 h-12 shadow-lg bg-cbva-navy hover:bg-cbva-navy/90 z-50"
        onClick={() => setOpen(!open)}
      >
        <MessageCircle className="w-5 h-5" />
      </Button>
      {open && (
        <div className="fixed bottom-20 right-6 w-80 bg-card border rounded-xl shadow-xl z-50 p-4 space-y-3">
          <p className="text-sm font-medium">CBVA Assistant</p>
          <p className="text-xs text-muted-foreground">AI assistant is not configured in this deployment. Connect an LLM provider via the backend to enable.</p>
          <Input placeholder="Ask a question..." value={message} onChange={e => setMessage(e.target.value)} disabled />
        </div>
      )}
    </>
  );
}
