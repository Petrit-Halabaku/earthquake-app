import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideEcharts } from "ngx-echarts";
import { provideToastr } from "ngx-toastr";

import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    provideEcharts(),
    provideToastr({
      timeOut: 5000,
      positionClass: "toast-top-right",
      // preventDuplicates: true,
      closeButton: true,
      progressBar: true,
      // enableHtml: true,
      toastClass: "ngx-toastr",
      // iconClasses: {
      //   error: "toast-error",
      //   info: "toast-info",
      //   success: "toast-success",
      //   warning: "toast-warning",
      // },
    }),
  ],
}).catch((err) => console.error(err));
