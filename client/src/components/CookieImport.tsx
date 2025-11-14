import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cookie, Info, CheckCircle2, XCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface CookieImportProps {
  onCookiesChange: (cookies: CookieData[]) => void;
  disabled?: boolean;
}

export function CookieImport({ onCookiesChange, disabled }: CookieImportProps) {
  const [cookieInput, setCookieInput] = useState("");
  const [parsedCookies, setParsedCookies] = useState<CookieData[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const parseCookies = (input: string): CookieData[] | null => {
    if (!input.trim()) {
      return [];
    }

    try {
      // Try parsing as JSON array first
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        // Validate each cookie has required fields
        const cookies = parsed.map((cookie) => {
          if (!cookie.name || !cookie.value) {
            throw new Error("Each cookie must have 'name' and 'value' fields");
          }
          return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
          };
        });
        return cookies;
      }
      throw new Error("Input must be a JSON array of cookies");
    } catch (jsonError) {
      // Try parsing as Netscape cookie format (name=value; domain=...; path=...)
      try {
        const lines = input.split("\n").filter((line) => line.trim());
        const cookies: CookieData[] = [];

        for (const line of lines) {
          const parts = line.split(";").map((p) => p.trim());
          if (parts.length === 0) continue;

          // First part should be name=value
          const [nameValue, ...attributes] = parts;
          const [name, ...valueParts] = nameValue.split("=");
          const value = valueParts.join("="); // Handle values with = in them

          if (!name || !value) {
            throw new Error(
              "Invalid cookie format. Each line should start with name=value",
            );
          }

          const cookie: CookieData = { name: name.trim(), value: value.trim() };

          // Parse optional attributes
          for (const attr of attributes) {
            const [key, val] = attr.split("=").map((s) => s.trim());
            if (key.toLowerCase() === "domain" && val) {
              cookie.domain = val;
            } else if (key.toLowerCase() === "path" && val) {
              cookie.path = val;
            }
          }

          cookies.push(cookie);
        }

        if (cookies.length === 0) {
          throw new Error("No valid cookies found");
        }

        return cookies;
      } catch (netscapeError) {
        throw new Error(
          `Failed to parse cookies. Supported formats:\n1. JSON: [{"name":"...", "value":"...", "domain":"...", "path":"..."}]\n2. Cookie format: name=value; domain=...; path=...`,
        );
      }
    }
  };

  const handleParse = () => {
    setParseError(null);
    try {
      const cookies = parseCookies(cookieInput);
      if (cookies === null) {
        throw new Error("Failed to parse cookies");
      }
      setParsedCookies(cookies);
      onCookiesChange(cookies);
      if (cookies.length > 0) {
        setParseError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setParseError(message);
      setParsedCookies([]);
      onCookiesChange([]);
    }
  };

  const handleClear = () => {
    setCookieInput("");
    setParsedCookies([]);
    setParseError(null);
    onCookiesChange([]);
  };

  return (
    <div className="space-y-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
            data-testid="button-toggle-cookie-import"
          >
            <div className="flex items-center gap-2">
              <Cookie className="h-4 w-4" />
              <span>
                Import Session Cookies {parsedCookies.length > 0 && `(${parsedCookies.length})`}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {isOpen ? "Hide" : "Show"}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 mt-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>How to export cookies from your browser:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>
                  Install a cookie export extension (e.g., "EditThisCookie" or "Cookie-Editor")
                </li>
                <li>Navigate to the website you're logged into</li>
                <li>Click the extension and export cookies as JSON</li>
                <li>Paste the exported JSON below</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="cookie-input" className="text-sm font-medium">
              Paste Cookies Here
            </Label>
            <Textarea
              id="cookie-input"
              data-testid="textarea-cookie-input"
              placeholder={`JSON format:\n[{"name":"session_id","value":"abc123","domain":".example.com","path":"/"}]\n\nOr cookie format:\nsession_id=abc123; domain=.example.com; path=/`}
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              disabled={disabled}
              className="min-h-32 font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleParse}
              disabled={!cookieInput.trim() || disabled}
              size="sm"
              data-testid="button-parse-cookies"
            >
              Parse Cookies
            </Button>
            <Button
              type="button"
              onClick={handleClear}
              disabled={!cookieInput && parsedCookies.length === 0}
              variant="outline"
              size="sm"
              data-testid="button-clear-cookies"
            >
              Clear
            </Button>
          </div>

          {parseError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-xs whitespace-pre-wrap">
                {parseError}
              </AlertDescription>
            </Alert>
          )}

          {parsedCookies.length > 0 && !parseError && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs">
                Successfully parsed {parsedCookies.length} cookie
                {parsedCookies.length !== 1 ? "s" : ""}:{" "}
                {parsedCookies.map((c) => c.name).join(", ")}
              </AlertDescription>
            </Alert>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
