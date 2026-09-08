"use client";

import type { ReactNode } from "react";
import { CameraProvider } from "@/components/camera/CameraService";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return <CameraProvider>{children}</CameraProvider>;
}
