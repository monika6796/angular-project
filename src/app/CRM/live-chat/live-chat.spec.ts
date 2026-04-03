import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveChat } from './live-chat';

describe('LiveChat', () => {
  let component: LiveChat;
  let fixture: ComponentFixture<LiveChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveChat],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveChat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
