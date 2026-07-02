import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Owner Login</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
