import { useState } from 'react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gender, WeightUnit, TrainingFrequency } from '../backend';
import { toast } from 'sonner';
import { User, Weight, Calendar, Timer, Dumbbell } from 'lucide-react';

export default function OnboardingPage() {
  const [gender, setGender] = useState<Gender>(Gender.male);
  const [bodyweight, setBodyweight] = useState<string>('70');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(WeightUnit.kg);
  const [trainingFrequency, setTrainingFrequency] = useState<TrainingFrequency>(TrainingFrequency.fourDays);
  const [restTime, setRestTime] = useState<string>('90');
  const [muscleGroupRestInterval, setMuscleGroupRestInterval] = useState<string>('5');

  const saveProfile = useSaveCallerUserProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const weight = parseFloat(bodyweight);
    if (isNaN(weight) || weight <= 0) {
      toast.error('Please enter a valid weight');
      return;
    }

    const rest = parseInt(restTime);
    if (isNaN(rest) || rest <= 0) {
      toast.error('Please select a valid rest time');
      return;
    }

    const muscleGroupRest = parseInt(muscleGroupRestInterval);
    if (isNaN(muscleGroupRest) || muscleGroupRest < 3 || muscleGroupRest > 7) {
      toast.error('Please select a valid muscle group rest interval');
      return;
    }

    try {
      await saveProfile.mutateAsync({
        gender,
        bodyweight: weight,
        weightUnit,
        trainingFrequency,
        darkMode: false,
        restTime: BigInt(rest),
        muscleGroupRestInterval: BigInt(muscleGroupRest),
      });
      toast.success('Profile created successfully!');
    } catch (error) {
      toast.error('Failed to create profile. Please try again.');
      console.error('Profile creation error:', error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-3xl font-bold">Welcome to FitTrack</CardTitle>
            <CardDescription className="text-base">
              Let's set up your profile to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Gender */}
              <div className="space-y-2">
                <Label htmlFor="gender" className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-primary" />
                  Gender
                </Label>
                <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                  <SelectTrigger id="gender" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Gender.male}>Male</SelectItem>
                    <SelectItem value={Gender.female}>Female</SelectItem>
                    <SelectItem value={Gender.other}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bodyweight */}
              <div className="space-y-2">
                <Label htmlFor="bodyweight" className="flex items-center gap-2 text-base">
                  <Weight className="h-4 w-4 text-primary" />
                  Bodyweight
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="bodyweight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={bodyweight}
                    onChange={(e) => setBodyweight(e.target.value)}
                    className="h-12 flex-1"
                    placeholder="70"
                  />
                  <Select value={weightUnit} onValueChange={(value) => setWeightUnit(value as WeightUnit)}>
                    <SelectTrigger className="h-12 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WeightUnit.kg}>kg</SelectItem>
                      <SelectItem value={WeightUnit.lb}>lb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Training Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency" className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  Training Frequency
                </Label>
                <Select
                  value={trainingFrequency}
                  onValueChange={(value) => setTrainingFrequency(value as TrainingFrequency)}
                >
                  <SelectTrigger id="frequency" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TrainingFrequency.threeDays}>3 days per week</SelectItem>
                    <SelectItem value={TrainingFrequency.fourDays}>4 days per week</SelectItem>
                    <SelectItem value={TrainingFrequency.fiveDays}>5 days per week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rest Time Between Sets */}
              <div className="space-y-2">
                <Label htmlFor="rest-time" className="flex items-center gap-2 text-base">
                  <Timer className="h-4 w-4 text-primary" />
                  Rest Time Between Sets
                </Label>
                <Select value={restTime} onValueChange={setRestTime}>
                  <SelectTrigger id="rest-time" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 seconds</SelectItem>
                    <SelectItem value="90">90 seconds</SelectItem>
                    <SelectItem value="120">120 seconds (2 min)</SelectItem>
                    <SelectItem value="180">180 seconds (3 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Muscle Group Rest Interval */}
              <div className="space-y-2">
                <Label htmlFor="muscle-group-rest" className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  Rest Between Muscle Groups
                </Label>
                <Select value={muscleGroupRestInterval} onValueChange={setMuscleGroupRestInterval}>
                  <SelectTrigger id="muscle-group-rest" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 minutes</SelectItem>
                    <SelectItem value="4">4 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="6">6 minutes</SelectItem>
                    <SelectItem value="7">7 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-semibold shadow-lg shadow-primary/20"
                disabled={saveProfile.isPending}
              >
                {saveProfile.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Creating Profile...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
