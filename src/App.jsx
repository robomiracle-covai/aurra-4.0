import React, { useState, useEffect } from 'react';
import SliderAndCards from './pages/Cards/SliderAndCards';
import FaceRecognition from './pages/FaceRecognition';
import QuestionAnswerView from './pages/Questions/QuestionAnswerView';
import Control from './pages/Control/Control';
import HardwareConnection from './pages/Hardware/HardwareConnection';
import VisitorRegistration from './pages/Registration/VisitorRegistration';
import InteractionModeView from './pages/Interaction/InteractionModeView';
import TestingInteractionModeView from './pages/Interaction/TestingInteractionModeView';
import FeaturePlaceholder from './pages/FeatureView/FeaturePlaceholder';
import WebLinks from './pages/WebLinks/WebLinks';
import GuidedTourView from './pages/GuidedTour/GuidedTourView';
import PublicFacilitiesView from './pages/Facilities/PublicFacilitiesView';
import PdfChatView from './pages/PdfChat/PdfChatView';
import DebugView from './pages/Debug/DebugView';
import VoiceAssistantBar from './components/VoiceAssistantBar';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AurraStartupSplashScreen from './components/AurraStartupSplashScreen';
import { logger } from './services/logger';
import { voiceNavigationService } from './services/voiceNavigationService';
import { devSettingsService } from './services/devSettingsService';
import './App.css';

function App() {
  const [showBootScreen, setShowBootScreen] = useState(true);
  const [bootPhase, setBootPhase] = useState('loading'); // 'loading' | 'glowing' | 'expanding' | 'completed'
  const [currentRoute, setCurrentRoute] = useState('/');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardsView, setShowCardsView] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const handleNavigate = (route, card = null) => {
    logger.breadcrumb('NAV', `Navigated to: ${route || '/'}`, card?.title ? { cardTitle: card.title } : null);
    setSelectedCard(card);
    if (!route || route === '/' || route === '/home' || route === 'home') {
      setShowCardsView(true);
      setIsAdminOpen(false);
      setCurrentRoute('/');
    } else if (route === '/admin') {
      setShowBootScreen(false);
      setBootPhase('completed');
      setIsAdminOpen(true);
      setCurrentRoute('/');
    } else if (route.includes('view=cards')) {
      setShowCardsView(true);
      setIsAdminOpen(false);
      setCurrentRoute('/');
    } else if (route.includes('view=slider')) {
      setShowCardsView(false);
      setIsAdminOpen(false);
      setCurrentRoute('/');
    } else {
      setShowBootScreen(false);
      setBootPhase('completed');
      setIsAdminOpen(false);
      setCurrentRoute(route);
    }
  };

  const handleToggleView = (isSlider) => {
    setShowCardsView(!isSlider);
    setCurrentRoute('/');
  };

  const handleOpenAdmin = () => {
    setIsAdminOpen(true);
  };

  const handleCloseAdmin = () => {
    setIsAdminOpen(false);
  };

  // Keep voice navigation initialized on boot so voice commands work continuously
  useEffect(() => {
    const cfg = devSettingsService.getSettings();
    voiceNavigationService.init({
      onNavigate: handleNavigate,
      onOpenAdmin: handleOpenAdmin,
      onToggleView: handleToggleView,
      autoStart: cfg.autoListenOnBoot !== false,
    });
  }, []);

  // Listen to custom events to guarantee showCardsView stays synchronized with slider/cards state
  useEffect(() => {
    const handleShowCards = () => setShowCardsView(true);
    const handleShowSlider = () => setShowCardsView(false);

    window.addEventListener('aurra_show_cards', handleShowCards);
    window.addEventListener('aurra_show_features', handleShowCards);
    window.addEventListener('aurra_morph_cards_in', handleShowCards);
    window.addEventListener('aurra_show_slider', handleShowSlider);

    return () => {
      window.removeEventListener('aurra_show_cards', handleShowCards);
      window.removeEventListener('aurra_show_features', handleShowCards);
      window.removeEventListener('aurra_morph_cards_in', handleShowCards);
      window.removeEventListener('aurra_show_slider', handleShowSlider);
    };
  }, []);

  // Determine whether the global persistent voice bar should be displayed
  // MUST NOT appear when the ads card/slideshow is active (both should not appear simultaneously)
  const isVoiceBarVisible =
    !isAdminOpen &&
    currentRoute !== '/form' &&
    currentRoute !== '/interaction' &&
    currentRoute !== '/testing-interaction' &&
    !(currentRoute === '/' && !showCardsView);

  return (
    <>
      {showBootScreen && (
        <AurraStartupSplashScreen
          bootPhase={bootPhase}
          onPhaseChange={setBootPhase}
          onComplete={() => {
            setBootPhase('completed');
            setShowBootScreen(false);
          }}
        />
      )}
      <div className={`aurra-app-root portal-app-wrapper phase-${bootPhase}`} id="main-app-container">
        <div className="aurra-view-container">
        {currentRoute === '/form' ? (
          <VisitorRegistration onNavigate={handleNavigate} />
        ) : currentRoute === '/interaction' ? (
          <InteractionModeView onNavigate={handleNavigate} />
        ) : currentRoute === '/testing-interaction' ? (
          <TestingInteractionModeView onNavigate={handleNavigate} />
        ) : currentRoute === '/face-recognition' ? (
          <FaceRecognition onNavigate={handleNavigate} />
        ) : currentRoute === '/qa' ? (
          <QuestionAnswerView onNavigate={handleNavigate} />
        ) : currentRoute === '/guided-tour' ? (
          <GuidedTourView onNavigate={handleNavigate} />
        ) : currentRoute === '/control' ? (
          <Control onNavigate={handleNavigate} />
        ) : currentRoute === '/hardware' ? (
          <HardwareConnection onNavigate={handleNavigate} />
        ) : currentRoute === '/weblinks' ? (
          <WebLinks onNavigate={handleNavigate} />
        ) : currentRoute === '/facilities' ? (
          <PublicFacilitiesView onNavigate={handleNavigate} />
        ) : currentRoute === '/pdf' ? (
          <PdfChatView onNavigate={handleNavigate} />
        ) : currentRoute === '/debug' ? (
          <DebugView onNavigate={handleNavigate} />
        ) : currentRoute !== '/' ? (
          <FeaturePlaceholder
            path={currentRoute}
            card={selectedCard}
            onNavigate={handleNavigate}
          />
        ) : (
          <SliderAndCards 
            onNavigate={handleNavigate} 
            showCardsInitially={showCardsView}
            isAdminOpen={isAdminOpen}
            onOpenAdmin={handleOpenAdmin}
            onCloseAdmin={handleCloseAdmin}
            onToggleView={handleToggleView}
          />
        )}
      </div>

      {/* Global Admin Dashboard Overlay */}
      {isAdminOpen && (
        <AdminDashboard
          onNavigate={handleNavigate}
          onClose={handleCloseAdmin}
        />
      )}

      {/* Globally Floating Persistent Voice Assistant Bar (hidden on main page, replaced by dual panels) */}
      {isVoiceBarVisible && (
        <div className={`global-floating-voice-bar ${currentRoute === '/' || currentRoute === '/home' || currentRoute === 'home' ? 'hide-on-main-page' : ''}`}>
          <VoiceAssistantBar
            onNavigate={handleNavigate}
            onOpenAdmin={handleOpenAdmin}
            onToggleView={handleToggleView}
            hideBarOnly={currentRoute === '/' || currentRoute === '/home' || currentRoute === 'home'}
          />
        </div>
      )}
    </div>
    </>
  );
}

export default App;
