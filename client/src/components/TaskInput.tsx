import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Shield, Lock, AlertCircle } from "lucide-react";
import { AuthPreference, Credentials } from "@shared/schema";
import { CookieImport } from "./CookieImport";

interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface TaskInputProps {
  onSubmit: (
    question: string, 
    authPreference: AuthPreference, 
    cookies?: CookieData[],
    credentials?: Credentials,
    verificationCode?: string
  ) => void;
  isLoading: boolean;
}

const exampleQuestions = [
  "How do I create a project in Linear?",
  "How do I filter a database in Notion?",
  "How do I create a new issue in GitHub?",
  "How do I schedule a tweet in Twitter?",
];

export function TaskInput({ onSubmit, isLoading }: TaskInputProps) {
  const [question, setQuestion] = useState("");
  const [authPreference, setAuthPreference] = useState<AuthPreference>("auto-detect");
  const [cookies, setCookies] = useState<CookieData[]>([]);
  const [cookieImportKey, setCookieImportKey] = useState(0);
  const [credentials, setCredentials] = useState<Credentials>({
    username: "",
    password: "",
    displayName: "",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const charCount = question.length;
  const maxChars = 500;

  const handleAuthPreferenceChange = (value: AuthPreference) => {
    setAuthPreference(value);
    // Clear validation error when changing auth preference
    setValidationError(null);
    // Clear cookies and verification code when switching away from "already-logged-in" mode
    if (value !== "already-logged-in") {
      setCookies([]);
      setVerificationCode("");
      // Increment key to force CookieImport to remount with fresh state next time
      setCookieImportKey(prev => prev + 1);
    }
    // Clear credentials when switching away from sign-in/sign-up modes
    if (value !== "need-sign-in" && value !== "need-sign-up") {
      setCredentials({ username: "", password: "", displayName: "" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      // Validate: "already-logged-in" mode requires cookies
      if (authPreference === "already-logged-in" && cookies.length === 0) {
        setValidationError("Session cookies are required when using 'Already logged in' mode. Please import your browser cookies or select a different authentication option.");
        return;
      }
      
      // Clear any previous validation errors
      setValidationError(null);
      
      // Only send cookies if in "already-logged-in" mode
      const cookiesToSend = authPreference === "already-logged-in" && cookies.length > 0 ? cookies : undefined;
      
      // Only send credentials if in sign-in/sign-up mode and credentials are provided
      const credentialsToSend = 
        (authPreference === "need-sign-in" || authPreference === "need-sign-up") && 
        (credentials.username || credentials.password || credentials.displayName)
          ? credentials
          : undefined;
      
      // Only send verification code if in "already-logged-in" mode and code is provided
      const verificationCodeToSend = 
        authPreference === "already-logged-in" && verificationCode.trim()
          ? verificationCode.trim()
          : undefined;
      
      onSubmit(question.trim(), authPreference, cookiesToSend, credentialsToSend, verificationCodeToSend);
    }
  };

  const handleExampleClick = (example: string) => {
    if (!isLoading) {
      setQuestion(example);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="task-question" className="text-lg font-semibold">
          What workflow would you like to capture?
        </Label>
        <p className="text-sm text-muted-foreground">
          Describe the task you want to automate. Our AI will navigate the application and capture each step.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          id="task-question"
          data-testid="input-task-question"
          placeholder="e.g., How do I create a project in Linear?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          className="min-h-32 resize-none text-base"
          maxLength={maxChars}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Be specific about the application and the task
          </p>
          <p className="text-xs text-muted-foreground">
            {charCount}/{maxChars}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">Authentication</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          How should the system handle login requirements?
        </p>
        <RadioGroup
          value={authPreference}
          onValueChange={(value) => handleAuthPreferenceChange(value as AuthPreference)}
          disabled={isLoading}
          className="space-y-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="auto-detect" id="auth-auto" data-testid="radio-auth-auto" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-auto" className="font-medium cursor-pointer">
                Auto-detect (Recommended)
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically checks login state and documents both scenarios
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="already-logged-in" id="auth-logged-in" data-testid="radio-auth-logged-in" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-logged-in" className="font-medium cursor-pointer">
                I'm already logged in
              </Label>
              <p className="text-sm text-muted-foreground">
                Use your existing browser session cookies to access logged-in content
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="need-sign-in" id="auth-sign-in" data-testid="radio-auth-sign-in" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-sign-in" className="font-medium cursor-pointer">
                I need to sign in
              </Label>
              <p className="text-sm text-muted-foreground">
                Focus on documenting the sign-in process
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="need-sign-up" id="auth-sign-up" data-testid="radio-auth-sign-up" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-sign-up" className="font-medium cursor-pointer">
                I need to sign up
              </Label>
              <p className="text-sm text-muted-foreground">
                Focus on documenting the sign-up process
              </p>
            </div>
          </div>
        </RadioGroup>

        {authPreference === "already-logged-in" && (
          <>
            <CookieImport 
              key={`cookie-import-${cookieImportKey}`}
              onCookiesChange={(cookies) => {
                setCookies(cookies);
                // Clear validation error when cookies are successfully imported
                if (cookies.length > 0) {
                  setValidationError(null);
                }
              }} 
              disabled={isLoading} 
            />
            
            <div className="space-y-3 mt-4 p-4 rounded-md bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">
                  2FA/MFA Verification Code (Optional)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                If the application requires a verification code during login, enter it here
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="verification-code" className="text-sm font-medium">
                  Verification Code
                </Label>
                <Input
                  id="verification-code"
                  data-testid="input-verification-code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={isLoading}
                  maxLength={10}
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                The system will automatically enter this code when prompted during the workflow
              </p>
            </div>
          </>
        )}

        {(authPreference === "need-sign-in" || authPreference === "need-sign-up") && (
          <div className="space-y-4 mt-4 p-4 rounded-md bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">
                {authPreference === "need-sign-up" ? "Sign Up Credentials" : "Sign In Credentials"}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {authPreference === "need-sign-up" 
                ? "Provide credentials to create an account and continue with the workflow"
                : "Provide credentials to log in and continue with the workflow"}
            </p>
            
            {authPreference === "need-sign-up" && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm font-medium">
                  Display Name (optional)
                </Label>
                <Input
                  id="displayName"
                  data-testid="input-display-name"
                  type="text"
                  placeholder="John Doe"
                  value={credentials.displayName}
                  onChange={(e) => setCredentials(prev => ({ ...prev, displayName: e.target.value }))}
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Email or Username
              </Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="you@example.com"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                disabled={isLoading}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Your credentials are used only to perform the workflow and are not stored.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Example Questions
        </p>
        <div className="flex flex-wrap gap-2">
          {exampleQuestions.map((example, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover-elevate active-elevate-2 px-4 py-2 text-sm"
              onClick={() => handleExampleClick(example)}
              data-testid={`badge-example-${index}`}
            >
              {example}
            </Badge>
          ))}
        </div>
      </div>

      {validationError && (
        <Alert variant="destructive" data-testid="alert-validation-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!question.trim() || isLoading}
        className="w-full sm:w-auto px-8"
        data-testid="button-capture-workflow"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isLoading ? "Capturing Workflow..." : "Capture Workflow"}
      </Button>
    </form>
  );
}
