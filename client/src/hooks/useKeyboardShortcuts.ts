import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsConfig {
  onVoiceToggle?: () => void;
  onFocusInput?: () => void;
  onSendMessage?: () => void;
  onNewProject?: () => void;
}

export function useKeyboardShortcuts({
  onVoiceToggle,
  onFocusInput,
  onSendMessage,
  onNewProject
}: KeyboardShortcutsConfig) {
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check for modifier keys
    const isCtrl = event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
    const isShift = event.shiftKey;
    const isAlt = event.altKey;

    // Voice toggle: Ctrl/Cmd + Shift + V
    if (isCtrl && isShift && event.key === 'V') {
      event.preventDefault();
      onVoiceToggle?.();
      return;
    }

    // Focus input: Ctrl/Cmd + K (like Discord/Slack)
    if (isCtrl && event.key === 'k') {
      event.preventDefault();
      onFocusInput?.();
      return;
    }

    // Send message: Ctrl/Cmd + Enter
    if (isCtrl && event.key === 'Enter') {
      event.preventDefault();
      onSendMessage?.();
      return;
    }

    // New project: Ctrl/Cmd + N
    if (isCtrl && event.key === 'n') {
      event.preventDefault();
      onNewProject?.();
      return;
    }

    // Space bar to start/stop voice (when not in input field)
    if (event.code === 'Space' && event.target instanceof HTMLElement) {
      const isInputField = event.target.tagName === 'INPUT' || 
                          event.target.tagName === 'TEXTAREA' || 
                          event.target.isContentEditable;
      
      if (!isInputField) {
        event.preventDefault();
        onVoiceToggle?.();
        return;
      }
    }

  }, [onVoiceToggle, onFocusInput, onSendMessage, onNewProject]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return the shortcuts for display in UI
  return {
    shortcuts: [
      { key: 'Ctrl+Shift+V', description: 'Toggle voice input' },
      { key: 'Space', description: 'Start/stop voice (when not typing)' },
      { key: 'Ctrl+K', description: 'Focus input field' },
      { key: 'Ctrl+Enter', description: 'Send message' },
      { key: 'Ctrl+N', description: 'New project' }
    ]
  };
}