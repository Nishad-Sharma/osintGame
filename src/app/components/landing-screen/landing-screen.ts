import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-screen',
  imports: [],
  templateUrl: './landing-screen.html',
  styleUrl: './landing-screen.scss',
})

export class LandingScreen {
    constructor(private router: Router) {}

    startGame() {
        this.router.navigate(['/game']);
    }
}
