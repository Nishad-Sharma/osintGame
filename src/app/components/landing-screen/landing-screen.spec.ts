import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LandingScreen } from './landing-screen';

describe('LandingScreen', () => {
  let component: LandingScreen;
  let fixture: ComponentFixture<LandingScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingScreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LandingScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
