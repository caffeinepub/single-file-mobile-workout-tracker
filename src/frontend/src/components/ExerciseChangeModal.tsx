import { useState } from 'react';
import { Exercise } from '../types';
import { useGetAlternativeExercises, useRecordExerciseChange } from '../hooks/useQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ExerciseChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentExercise: Exercise;
  onExerciseSelected: (exercise: Exercise) => void;
}

export default function ExerciseChangeModal({
  open,
  onOpenChange,
  currentExercise,
  onExerciseSelected,
}: ExerciseChangeModalProps) {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const { data: alternatives = [], isLoading } = useGetAlternativeExercises(currentExercise.primaryMuscleGroup);
  const recordChange = useRecordExerciseChange();

  const handleSelect = async (exercise: Exercise) => {
    if (exercise.name === currentExercise.name) {
      toast.info('This is the current exercise');
      return;
    }

    setSelectedExercise(exercise);

    try {
      // Record the change in the backend
      await recordChange.mutateAsync({
        originalExercise: currentExercise.name,
        alternativeExercise: exercise.name,
      });

      // Notify parent component
      onExerciseSelected(exercise);
      toast.success(`Changed to ${exercise.name}`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to change exercise');
      console.error('Exercise change error:', error);
    } finally {
      setSelectedExercise(null);
    }
  };

  // Filter out the current exercise from alternatives
  const filteredAlternatives = Array.isArray(alternatives) 
    ? alternatives.filter(ex => ex.name !== currentExercise.name)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/50 frosted-glass flex flex-col p-0 gap-0 max-h-[85vh] sm:max-h-[80vh]">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">Change Exercise</DialogTitle>
          <DialogDescription className="text-base">
            Select an alternative exercise for {currentExercise.primaryMuscleGroup}
          </DialogDescription>
          {filteredAlternatives.length > 0 && (
            <p className="text-sm font-medium text-primary pt-2">
              {filteredAlternatives.length} alternative{filteredAlternatives.length !== 1 ? 's' : ''} available for {currentExercise.primaryMuscleGroup}
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 px-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ maxHeight: '70vh' }}>
            <div className="space-y-2 pr-2">
              {filteredAlternatives.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No alternative exercises available
                </p>
              ) : (
                filteredAlternatives.map((exercise) => (
                  <Button
                    key={exercise.name}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 text-left hover:bg-white/10 hover:border-primary/50 transition-all hover:shadow-glow-primary active:scale-95 rounded-2xl"
                    onClick={() => handleSelect(exercise)}
                    disabled={recordChange.isPending && selectedExercise?.name === exercise.name}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <a
                        href={exercise.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 tap-target"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-all">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </a>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-base">{exercise.name}</span>
                          {recordChange.isPending && selectedExercise?.name === exercise.name && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                            {exercise.primaryMuscleGroup}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-white/5 border-white/20">
                            {exercise.equipmentType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
