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

function parseCookiesInput(input: string): CookieData[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1) Try JSON format first
  try {
    const parsed = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      throw new Error("JSON root must be an array");
    }

    const cookies: CookieData[] = parsed.map((raw: any) => {
      if (!raw.name || !raw.value) {
        throw new Error("Each cookie must have name and value");
      }
      return {
        name: String(raw.name),
        value: String(raw.value),
        domain: raw.domain ? String(raw.domain) : undefined,
        path: raw.path ? String(raw.path) : "/",
      };
    });

    if (cookies.length === 0) {
      throw new Error("No cookies found in JSON");
    }

    return cookies;
  } catch {
    // fall through to Netscape-style parsing
  }

  // 2) Try "name=value; domain=...; path=..." per line
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cookies: CookieData[] = [];

  for (const line of lines) {
    const [nameValuePart, ...attrParts] = line.split(";");
    const [name, value] = nameValuePart.split("=").map((s) => s.trim());

    if (!name || typeof value === "undefined") {
      throw new Error(`Invalid cookie line: "${line}"`);
    }

    const cookie: CookieData = { name, value, path: "/" };

    for (const attr of attrParts) {
      const [attrNameRaw, attrValueRaw] = attr.split("=").map((s) => s.trim());
      const attrName = attrNameRaw?.toLowerCase();
      const attrValue = attrValueRaw ?? "";

      if (!attrName) continue;

      if (attrName === "domain") {
        cookie.domain = attrValue;
      } else if (attrName === "path") {
        cookie.path = attrValue || "/";
      }
    }

    cookies.push(cookie);
  }

  if (cookies.length === 0) {
    throw new Error("No cookies parsed from text");
  }

  return cookies;
}

export function CookieImport({ onCookiesChange, disabled }: CookieImportProps) {
  const [cookieInput, setCookieInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCookies, setParsedCookies] = useState<CookieData[]>([]);
  const [open, setOpen] = useState(false);

  const handleParse = () => {
    try {
      setParseError(null);

      const cookies = parseCookiesInput(cookieInput);
      setParsedCookies(cookies);
      onCookiesChange(cookies);

      console.log("[CookieImport] Parsed cookies:", cookies);
    } catch (err) {
      console.error("[CookieImport] Failed to parse cookies:", err);
      setParsedCookies([]);
      onCookiesChange([]);

      setParseError(
        "Failed to parse cookies. Supported formats:\n" +
          '1. JSON: [{"name":"...", "value":"...", "domain":"...", "path":"/"}]\n' +
          "2. Cookie format: name=value; domain=...; path=/",
      );
    }
  };

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <Cookie className="h-4 w-4" />
            <span>Import session cookies (optional)</span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="cookie-input" className="text-xs font-medium">
              Cookies JSON or text
            </Label>
            <Textarea
              id="cookie-input"
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              disabled={disabled}
              placeholder={`Paste cookies here in one of these formats:

1) Chrome export JSON:
[
  {
    "name": "loggedIn",
    "value": "1",
    "domain": ".linear.app",
    "path": "/"
  }
]

2) Text per line:
loggedIn=1; domain=.linear.app; path=/`}
              className="min-h-[120px] text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleParse}
              disabled={disabled || !cookieInput.trim()}
            >
              Parse cookies
            </Button>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Only name, value, domain, and path are used</span>
            </div>
          </div>

          {parseError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-wrap text-xs">
                {parseError}
              </AlertDescription>
            </Alert>
          )}

          {!parseError && parsedCookies.length > 0 && (
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
