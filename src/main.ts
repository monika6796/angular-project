import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing.module';
import { importProvidersFrom } from '@angular/core';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { authInterceptor } from './app/interceptor/auth.interceptor';
import { errorInterceptor } from './app/interceptors/error-interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor,errorInterceptor])),
    provideCharts(withDefaultRegisterables()),
    importProvidersFrom(AppRoutingModule)
  ]
}).catch(err => console.error(err));
