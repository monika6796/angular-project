import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { Menus } from './menus/menus';
import { authGuard } from './guards/auth-guard';
import { Whatsapp } from './whatsapp/whatsapp';
import { Templates } from './whatsappsmain/templates/templates';
import { guestGuard } from './guards/guest-guard';
import { CreateTempalte } from './whatsappsmain/create-tempalte/create-tempalte';
import { Register } from './register/register';
import { WhatsAppConnectComponent } from './whatsappsconnect/components/whatsapp-connect.component/whatsapp-connect.component';
import { LiveChat } from './CRM/live-chat/live-chat';
import { BulkCampaign } from './CRM/bulk-campaign/bulk-campaign';
const routes: Routes = [
  {path:'register',component:Register},
 { path:'', redirectTo:'login', pathMatch:'full' },

 { path:'login', component: LoginComponent },

 {
  path:'home',
  component: Menus,
  canActivate:[authGuard],
  children:[
    { path:'', redirectTo:'dashboard', pathMatch:'full' },
    { path:'dashboard', component: DashboardComponent },
    { path:'whatsapp-templates', component: Templates },
    { path:'app-whatsapp', component: Whatsapp },
    {path:'create_templates',component:CreateTempalte},
    {path:'whatsapp_connect',component:WhatsAppConnectComponent},
    {path:'message_chats', component:LiveChat},
    {path:'bulk-campagain',component:BulkCampaign},

    { path:'**', redirectTo:'dashboard' } 
  ]
 },
 

 { path:'**', redirectTo:'login' }
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
