import { useState, useEffect } from 'react';
import { useUpdateProfile } from '../hooks/useQueries';
import { UserProfile, WeightUnit } from '../backend';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Weight } from 'lucide-react';

interface BodyweightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile;
}

export default function BodyweightModal({ open, onOpenChange, userProfile }: BodyweightModalProps) {
  const [bodyweightInput, setBodyweightInput] = useState<string>(userProfile.bodyweight.toString());
  const [unit, setUnit] = useState<WeightUnit>(userProfile.weightUnit);

  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (open) {
      setBodyweightInput(userProfile.bodyweight.toString());
      setUnit(userProfile.weightUnit);
    }
  }, [open, userProfile]);

  const handleSave = async () => {
    const trimmedInput = bodyweightInput.trim();
    
    if (!/^\d+(\.\d+)?$/.test(trimmedInput)) {
      toast.error('Please enter a valid bodyweight');
      return;
    }

    const weight = parseFloat(trimmedInput);
    
    if (isNaN(weight) || weight <= 0 || weight > 500) {
      toast.error('Please enter a valid bodyweight (0-500)');
      return;
    }

    try {
      await updateProfile.mutateAsync({
        bodyweight: weight,
        weightUnit: unit,
      });
      
      toast.success('Saved');
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update bodyweight. Please try again.');
      console.error('Bodyweight save error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-t-2xl frosted-glass">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <Weight className="h-6 w-6 text-primary" />
            Log Bodyweight
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Update your current bodyweight
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="bodyweight-input" className="text-base font-medium">
              Bodyweight
            </Label>
            <div className="flex gap-2">
              <input
                id="bodyweight-input"
                type="number"
                step="0.1"
                value={bodyweightInput}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setBodyweightInput(value);
                  }
                }}
                placeholder="Enter weight"
                className="p-4 text-xl bg-input rounded-lg text-foreground flex-1 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="off"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as WeightUnit)}
                className="p-4 text-xl bg-input rounded-lg text-foreground w-24 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={WeightUnit.kg}>kg</option>
                <option value={WeightUnit.lb}>lb</option>
              </select>
            </div>
          </div>

          <Button
            onClick={handleSave}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base font-medium"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Saving...
              </>
            ) : (
              'Save Bodyweight'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
