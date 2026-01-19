import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '../../services/game';

@Component({
  selector: 'app-landing-screen',
  standalone: true, // old ng required declaring every component in app.module.ts - this removes the need. just declare all imports below
  imports: [],
  templateUrl: './landing-screen.html',
  styleUrl: './landing-screen.scss',
})

export class LandingScreen {
    constructor(private game: Game, private router: Router) {}

    async startGame() {
        await this.game.startGame();
        this.router.navigate(['/game']);
    }
}
