import React, { useState } from 'react';
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
import VoiceAssistantBar from './components/VoiceAssistantBar';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AurraStartupSplashScreen from './components/AurraStartupSplashScreen';
import './App.css';

function App() {
  const [showBootScreen, setShowBootScreen] = useState(true);
  const [bootPhase, setBootPhase] = useState('loading'); // 'loading' | 'glowing' | 'expanding' | 'completed'
  const [currentRoute, setCurrentRoute] = useState('/');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardsView, setShowCardsView] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const handleNavigate = (route, card = null) => {
    setSelectedCard(card);
    if (!route || route === '/' || route === '/home') {
      setShowCardsView(false);
      setIsAdminOpen(false);
      setCurrentRoute('/');
    } else if (route === '/admin') {
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

      {/* Globally Floating Persistent Voice Assistant Bar (hidden while in Admin, Form, Interaction Mode, and Testing Lab) */}
      {!isAdminOpen && currentRoute !== '/form' && currentRoute !== '/interaction' && currentRoute !== '/testing-interaction' && (
        <div className="global-floating-voice-bar">
          <VoiceAssistantBar
            onNavigate={handleNavigate}
            onOpenAdmin={handleOpenAdmin}
            onToggleView={handleToggleView}
          />
        </div>
      )}
    </div>
    </>
  );
}

export default App;
