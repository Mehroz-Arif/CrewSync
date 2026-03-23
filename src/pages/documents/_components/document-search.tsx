import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import DocumentCard from "./document-card.tsx";

type Props = {
  isAdmin: boolean;
  onDelete: (docId: string) => void;
};

export default function DocumentSearch({ isAdmin, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const isSearching = debouncedQuery.trim().length > 0;

  const results = useQuery(
    api.documents.searchDocuments,
    isSearching ? { query: debouncedQuery.trim() } : "skip",
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => setQuery("")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {isSearching && (
        <div className="space-y-2">
          {!results ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No documents found for "{debouncedQuery}"
            </p>
          ) : (
            results.map((doc) => (
              <div key={doc._id}>
                {doc.folderName && (
                  <p className="text-xs text-muted-foreground mb-1 ml-1">
                    in {doc.folderName}
                  </p>
                )}
                <DocumentCard doc={doc} isAdmin={isAdmin} onDelete={onDelete} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
