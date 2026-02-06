import { Home, Dumbbell, History, Activity, Settings } from 'lucide-react';
import { useState } from 'react';
import { UserProfile } from '../backend';
import SettingsModal from './SettingsModal';

type Page = 'dashboard' | 'newWorkout' | 'history' | 'progress' | 'settings';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userProfile: UserProfile;
}

export default function BottomNav({ currentPage, onNavigate, userProfile }: BottomNavProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleNavClick = (page: Page) => {
    handleVibrate();
    if (page === 'settings') {
      setShowSettings(true);
    } else {
      onNavigate(page);
    }
  };

  const tabs = [
    { id: 'dashboard' as Page, label: 'Home', icon: Home },
    { id: 'newWorkout' as Page, label: 'Workout', icon: Dumbbell },
    { id: 'progress' as Page, label: 'Progress', icon: Activity },
    { id: 'history' as Page, label: 'History', icon: History },
    { id: 'settings' as Page, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-bottom-nav bg-card/95 frosted-glass border-t border-border safe-area-bottom" style={{ height: '80px' }}>
        <div className="flex items-center justify-around h-full px-2 max-w-2xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPage === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleNavClick(tab.id)}
                className={`tap-target flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-150 active:scale-95 min-w-[60px] ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        userProfile={userProfile}
      />
    </>
  );
}
