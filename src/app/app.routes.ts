import { Routes } from '@angular/router';
import { LandingScreen } from './components/landing-screen/landing-screen';
import { GuessScreen } from './components/guess-screen/guess-screen';
import { EndGameScreen } from './components/end-game-screen/end-game-screen';

export const routes: Routes = [
    { path: '', component: LandingScreen },
    { path: 'game', component: GuessScreen},
    { path: 'end', component: EndGameScreen } 
];
