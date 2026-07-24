import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';
import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface VoiceInputProps {
  onVoiceCommand: (command: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInput({ onVoiceCommand, disabled = false, className }: VoiceInputProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isListening,
    isSupported,
    transcript,
    confidence,
    startListening,
    stopListening,
    resetTranscript
  } = useVoiceCommands((command) => {
    if (command.trim()) {
      setIsProcessing(true);
      onVoiceCommand(command);
      setTimeout(() => {
        setIsProcessing(false);
        setShowTranscript(false);
        resetTranscript();
      }, 1000);
    }
  });

  useEffect(() => {
    if (transcript) {
      setShowTranscript(true);
    }
  }, [transcript]);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-2 text-slate-500", className)}>
        <VolumeX className="h-4 w-4" />
        <span className="text-xs">Voice not supported</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={isListening ? "default" : "outline"}
          size="sm"
          onClick={handleToggleListening}
          disabled={disabled || isProcessing}
          className={cn(
            "relative transition-all duration-200",
            isListening && "bg-red-500 hover:bg-red-600 text-white animate-pulse",
            !isListening && "border-emerald-200 hover:bg-emerald-50"
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isListening ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
          
          {isListening && (
            <span className="ml-2 text-xs font-medium">Listening...</span>
          )}
          {!isListening && !isProcessing && (
            <span className="ml-2 text-xs">Voice</span>
          )}
          {isProcessing && (
            <span className="ml-2 text-xs">Processing...</span>
          )}
        </Button>

        {isListening && (
          <div className="flex items-center gap-1">
            <Volume2 className="h-3 w-3 text-emerald-600" />
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 bg-emerald-500 rounded-full transition-all duration-150",
                    "animate-pulse"
                  )}
                  style={{
                    height: `${Math.random() * 16 + 8}px`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transcript Display */}
      {showTranscript && transcript && (
        <div className="flex flex-col gap-1 p-2 bg-slate-50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {isListening ? "Listening" : "Heard"}
            </Badge>
            {confidence > 0 && (
              <Badge 
                variant={confidence > 0.8 ? "default" : confidence > 0.5 ? "secondary" : "destructive"}
                className="text-xs"
              >
                {Math.round(confidence * 100)}% confident
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-700 italic">"{transcript}"</p>
        </div>
      )}

      {/* Voice Commands Help */}
      {!isListening && !transcript && (
        <div className="text-xs text-slate-500 space-y-1">
          <p className="font-medium">Try voice commands like:</p>
          <ul className="text-xs space-y-0.5 ml-2">
            <li>• "How many projects do I have?"</li>
            <li>• "Create a new project for mobile app"</li>
            <li>• "What tasks are due this week?"</li>
            <li>• "Show me overdue tasks"</li>
          </ul>
        </div>
      )}

      {/* Error State */}
      {!isSupported && (
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>Speech recognition not available in this browser</span>
        </div>
      )}
    </div>
  );
}