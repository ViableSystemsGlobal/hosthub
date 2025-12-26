"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  totalItems?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  totalItems,
  className,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  
  // Show page numbers around current page
  const getVisiblePages = () => {
    if (totalPages <= 7) return pages
    
    const visible: number[] = []
    
    if (currentPage <= 3) {
      visible.push(...pages.slice(0, 5), -1, totalPages)
    } else if (currentPage >= totalPages - 2) {
      visible.push(1, -1, ...pages.slice(totalPages - 5))
    } else {
      visible.push(1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages)
    }
    
    return visible
  }

  const visiblePages = getVisiblePages()
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems || 0)

  if (totalPages <= 1) return null

  return (
    <div className={cn("flex items-center justify-between px-2 py-4", className)}>
      <div className="text-sm text-muted-foreground">
        {totalItems !== undefined && (
          <>
            Showing {startItem} to {endItem} of {totalItems} results
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {visiblePages.map((page, idx) => {
            if (page === -1) {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              )
            }
            
            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className="min-w-[2.5rem]"
              >
                {page}
              </Button>
            )
          })}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

