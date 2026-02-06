import { useState, useEffect } from 'react';
import { useSaveCallerUserProfile, useUpdateProfile } from '../hooks/useQueries';
import { UserProfile, Gender, WeightUnit, TrainingFrequency } from '../backend';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { User, Weight, Calendar, Moon, Timer, Dumbbell } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile;
}

export default function SettingsModal({ open, onOpenChange, userProfile }: SettingsModalProps) {
  const [gender, setGender] = useState<Gender>(userProfile.gender);
  const [bodyweightInput, setBodyweightInput] = useState<string>(userProfile.bodyweight.toString());
  const [unit, setUnit] = useState<WeightUnit>(userProfile.weightUnit);
  const [trainingFrequency, setTrainingFrequency] = useState<TrainingFrequency>(userProfile.trainingFrequency);
  const [darkMode, setDarkMode] = useState<boolean>(userProfile.darkMode);
  const [restTime, setRestTime] = useState<string>(userProfile.restTime.toString());
  const [muscleGroupRestInterval, setMuscleGroupRestInterval] = useState<string>(userProfile.muscleGroupRestInterval.toString());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { theme, setTheme } = useTheme();
  const saveProfile = useSaveCallerUserProfile();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (open) {
      setGender(userProfile.gender);
      setBodyweightInput(userProfile.bodyweight.toString());
      setUnit(userProfile.weightUnit);
      setTrainingFrequency(userProfile.trainingFrequency);
      setDarkMode(userProfile.darkMode);
      setRestTime(userProfile.restTime.toString());
      setMuscleGroupRestInterval(userProfile.muscleGroupRestInterval.toString());
      setSaveSuccess(false);
    }
  }, [open, userProfile]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    setTheme(checked ? 'dark' : 'light');
  };

  const handleSave = async () => {
    const restTimeValue = BigInt(restTime);
    const muscleGroupRestValue = parseInt(muscleGroupRestInterval);

    if (muscleGroupRestValue < 3 || muscleGroupRestValue > 7) {
      toast.error('Muscle group rest interval must be between 3 and 7 minutes');
      return;
    }

    try {
      await saveProfile.mutateAsync({
        gender,
        bodyweight: userProfile.bodyweight,
        weightUnit: userProfile.weightUnit,
        trainingFrequency,
        darkMode,
        restTime: restTimeValue,
        muscleGroupRestInterval: BigInt(muscleGroupRestValue),
      });
      
      setSaveSuccess(true);
      toast.success('Settings saved successfully!');
      
      setTimeout(() => {
        onOpenChange(false);
      }, 800);
    } catch (error) {
      toast.error('Failed to save settings. Please try again.');
      console.error('Settings save error:', error);
    }
  };

  const handleBodyweightSave = async () => {
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
        muscleGroupRestInterval: undefined,
      });
      
      toast.success('Saved');
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      toast.error('Failed to save bodyweight');
      console.error('Bodyweight save error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md rounded-t-2xl frosted-glass">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Settings</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Update your profile and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Profile
            </h3>

            <div className="space-y-2">
              <Label htmlFor="settings-gender" className="flex items-center gap-2 text-base font-medium">
                <User className="h-4 w-4 text-primary" />
                Gender
              </Label>
              <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <SelectTrigger id="settings-gender" className="h-14 rounded-lg bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value={Gender.male}>Male</SelectItem>
                  <SelectItem value={Gender.female}>Female</SelectItem>
                  <SelectItem value={Gender.other}>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-bodyweight" className="flex items-center gap-2 text-base font-medium">
                <Weight className="h-4 w-4 text-primary" />
                Bodyweight
              </Label>
              <div className="flex gap-2">
                <input
                  id="settings-bodyweight"
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
              <Button
                onClick={handleBodyweightSave}
                disabled={updateProfile.isPending}
                className="mt-2 w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base font-medium"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Bodyweight'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-frequency" className="flex items-center gap-2 text-base font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                Training Frequency
              </Label>
              <Select
                value={trainingFrequency}
                onValueChange={(value) => setTrainingFrequency(value as TrainingFrequency)}
              >
                <SelectTrigger id="settings-frequency" className="h-14 rounded-lg bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value={TrainingFrequency.threeDays}>3 days per week</SelectItem>
                  <SelectItem value={TrainingFrequency.fourDays}>4 days per week</SelectItem>
                  <SelectItem value={TrainingFrequency.fiveDays}>5 days per week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-rest-time" className="flex items-center gap-2 text-base font-medium">
                <Timer className="h-4 w-4 text-primary" />
                Rest Time Between Sets
              </Label>
              <Select value={restTime} onValueChange={setRestTime}>
                <SelectTrigger id="settings-rest-time" className="h-14 rounded-lg bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                  <SelectItem value="120">120 seconds (2 min)</SelectItem>
                  <SelectItem value="180">180 seconds (3 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-muscle-group-rest" className="flex items-center gap-2 text-base font-medium">
                <Dumbbell className="h-4 w-4 text-primary" />
                Rest Between Muscle Groups
              </Label>
              <Select value={muscleGroupRestInterval} onValueChange={setMuscleGroupRestInterval}>
                <SelectTrigger id="settings-muscle-group-rest" className="h-14 rounded-lg bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="3">3 minutes</SelectItem>
                  <SelectItem value="4">4 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="6">6 minutes</SelectItem>
                  <SelectItem value="7">7 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Appearance
            </h3>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-primary" />
                <Label htmlFor="dark-mode" className="cursor-pointer text-base font-medium">
                  Dark Mode
                </Label>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            className={`w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base font-medium transition-all duration-200 ${
              saveSuccess ? 'bg-success hover:bg-success' : ''
            }`}
            disabled={saveProfile.isPending}
          >
            {saveProfile.isPending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <span className="mr-2">✓</span>
                Saved!
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
