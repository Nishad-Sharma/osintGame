import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Game, Guess } from '../../services/game'

@Component({
  selector: 'app-end-game-screen',
  standalone: true,
  imports: [],
  templateUrl: './end-game-screen.html',
  styleUrl: './end-game-screen.scss',
})
export class EndGameScreen {
    constructor(public game: Game, private router: Router) { }

    restartGame() {
        this.game.resetGame();
        this.router.navigate(['/']);
    }

    formatDistance(distance: number | undefined): string {
        if (distance === undefined) {
            return "";
        }
        const formattedDistance = distance >= 1000 
            ? (distance / 1000).toFixed(2) + 'km' 
            : distance.toFixed(2) + 'm';
        return formattedDistance;
    }
}
