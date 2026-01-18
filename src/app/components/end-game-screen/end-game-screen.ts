import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '../../services/game'

@Component({
  selector: 'app-end-game-screen',
  imports: [],
  templateUrl: './end-game-screen.html',
  styleUrl: './end-game-screen.scss',
})
export class EndGameScreen {
    totalScore: number;
    constructor(public game: Game, private router: Router) {
        this.totalScore = this.game.getTotalScore();
    }

    restartGame() {
        this.game.resetGame();
        this.router.navigate(['/']);
    }
}
