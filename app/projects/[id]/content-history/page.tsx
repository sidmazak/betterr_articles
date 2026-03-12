"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Eye, Pencil } from "lucide-react";
import Link from "next/link";

type ContentItem = {
  id: string;
  calendar_item_id: string | null;
  title: string;
  search_term: string;
  secondary_keywords: string[];
  status: string;
  words: number;
  published_url: string | null;
  published_at: string | null;
  created_at: string;
};

export default function ContentHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [items, setItems] = useState<ContentItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [totalArticles, setTotalArticles] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [avgWords, setAvgWords] = useState(0);

  useEffect(() => {
    if (!id) return;
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (statusFilter !== "all") q.set("status", statusFilter);
    q.set("sort", sort);
    fetch(`/api/projects/${id}/content-history?${q}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ContentItem[]) => {
        setItems(data);
        setTotalArticles(data.length);
        const published = data.filter((i) => i.status === "published");
        setPublishedCount(published.length);
        const totalWords = data.reduce((s, i) => s + i.words, 0);
        setAvgWords(data.length ? Math.round(totalWords / data.length) : 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id, search, statusFilter, sort]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content history</h1>
        <p className="mt-1 text-muted-foreground">
          Track your article performance, SEO metrics, and content analytics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total articles</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArticles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. word count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWords.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your articles</CardTitle>
          <CardDescription>
            Detailed view of all your generated content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">No articles yet. Generate content from the calendar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 font-medium">Article title</th>
                    <th className="text-left py-3 font-medium">Search term</th>
                    <th className="text-left py-3 font-medium">Status</th>
                    <th className="text-left py-3 font-medium">Words</th>
                    <th className="text-left py-3 font-medium">Published</th>
                    <th className="text-left py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        {item.secondary_keywords.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.secondary_keywords.slice(0, 3).map((keyword) => (
                              <Badge key={keyword} variant="outline" className="font-normal">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">{item.search_term || "—"}</td>
                      <td className="py-3">
                        <Badge variant={item.status === "published" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="py-3">{item.words.toLocaleString()}</td>
                      <td className="py-3">
                        {item.published_at
                          ? new Date(item.published_at).toLocaleDateString()
                          : "Not published"}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link href={`/projects/${id}/articles/${item.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {item.calendar_item_id && item.status !== "published" && !item.published_url && (
                            <Link href={`/projects/${id}/write/${item.calendar_item_id}`}>
                              <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4 mr-1" />
                                Regenerate
                              </Button>
                            </Link>
                          )}
                          {item.status === "published" && item.published_url && (
                            <a href={item.published_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View live
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
