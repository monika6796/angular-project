import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTempalte } from './create-tempalte';

describe('CreateTempalte', () => {
  let component: CreateTempalte;
  let fixture: ComponentFixture<CreateTempalte>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTempalte],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTempalte);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
