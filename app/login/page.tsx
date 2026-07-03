import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllowedOwnerEmails } from "@/lib/auth/owner";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Workspace Login</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm allowedEmails={getAllowedOwnerEmails()} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
