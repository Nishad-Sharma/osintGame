import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EndGameScreen } from './end-game-screen';

describe('EndGameScreen', () => {
  let component: EndGameScreen;
  let fixture: ComponentFixture<EndGameScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EndGameScreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EndGameScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
