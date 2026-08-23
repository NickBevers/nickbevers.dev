/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    session?: import("@/platform").SessionPayload;
  }
}
