#!/bin/bash

# A script to combine multiple Markdown files from the ./docs/ directory
# into a single PDF, automatically resolving inter-document links and
# adding a custom title page.

# --- Configuration ---
# Information for the title page.
TITLE='SqueakyRObot FSRS Documentation'
ABSTRACT=''
# AUTHOR='@squeakyrobot' # You can change or remove this

# The final PDF output file name.
OUTPUT_PDF="squeakrobot-fsrs-documentation.pdf"

# --- Safety Checks ---
set -e # Exit immediately if a command exits with a non-zero status.

# --- Functions ---
# Extract markdown links from a file and return referenced .md files
extract_md_references() {
    local file="$1"
    # Extract links that point to .md files (handling both relative and direct paths)
    # Look for patterns like ](something.md) or ](./something.md) or ](../something.md)
    # Use awk to preserve order and remove duplicates while maintaining first occurrence
    grep -oE '\]\([^)]*\.md[^)]*\)' "$file" 2>/dev/null | \
    sed -E 's/\]\(\.?\/?([^)#]+\.md)[^)]*\)/\1/' | \
    sed 's|^\.\./||' | \
    sed 's|^/||' | \
    awk '!seen[$0]++'
}

# Build ordered list of documents based on reference order
build_document_order() {
    local docs_dir="$1"
    local -a ordered_docs=()
    local -a remaining_docs=()
    local -a processed_files=()
    
    # Get all .md files in the directory
    mapfile -t all_docs < <(find "$docs_dir" -maxdepth 1 -name "*.md" -type f -exec basename {} \; | sort)
    
    echo "--- DEBUG: Found ${#all_docs[@]} total .md files ---" >&2
    printf "  %s\n" "${all_docs[@]}" >&2
    echo "" >&2
    
    # Start with index.md if it exists
    if [[ " ${all_docs[@]} " =~ " index.md " ]]; then
        ordered_docs+=("index.md")
        processed_files+=("index.md")
        echo "--- DEBUG: Starting with index.md ---" >&2
    fi
    
    # Process files to find references
    local queue=("${ordered_docs[@]}")
    while [ ${#queue[@]} -gt 0 ]; do
        local current_file="${queue[0]}"
        queue=("${queue[@]:1}") # Remove first element
        
        echo "--- DEBUG: Processing references in: $current_file ---" >&2
        
        # Extract references from current file
        mapfile -t refs < <(extract_md_references "$docs_dir/$current_file")
        
        if [ ${#refs[@]} -gt 0 ]; then
            echo "  Found ${#refs[@]} references:" >&2
            printf "    %s\n" "${refs[@]}" >&2
        else
            echo "  No references found" >&2
        fi
        
        for ref in "${refs[@]}"; do
            # Skip empty references
            if [ -z "$ref" ]; then
                continue
            fi
            
            # Get just the filename
            ref_basename=$(basename "$ref")
            
            # Check if this file exists and hasn't been processed yet
            if [[ " ${all_docs[@]} " =~ " $ref_basename " ]] && \
               [[ ! " ${processed_files[@]} " =~ " $ref_basename " ]]; then
                ordered_docs+=("$ref_basename")
                processed_files+=("$ref_basename")
                queue+=("$ref_basename")
                echo "  ✓ Added to order: $ref_basename" >&2
            else
                if [[ ! " ${all_docs[@]} " =~ " $ref_basename " ]]; then
                    echo "  ✗ Not found in docs: $ref_basename" >&2
                else
                    echo "  ✗ Already processed: $ref_basename" >&2
                fi
            fi
        done
        echo "" >&2
    done
    
    # Add any remaining files that weren't referenced
    for doc in "${all_docs[@]}"; do
        if [[ ! " ${processed_files[@]} " =~ " $doc " ]]; then
            remaining_docs+=("$doc")
        fi
    done
    
    if [ ${#remaining_docs[@]} -gt 0 ]; then
        echo "--- DEBUG: Unreferenced files (added at end): ---" >&2
        printf "  %s\n" "${remaining_docs[@]}" >&2
        echo "" >&2
    fi
    
    # Output the complete ordered list, filtering out empty strings
    for doc in "${ordered_docs[@]}"; do
        if [ -n "$doc" ]; then
            printf '%s\n' "$doc"
        fi
    done
    for doc in "${remaining_docs[@]}"; do
        if [ -n "$doc" ]; then
            printf '%s\n' "$doc"
        fi
    done
}

# --- Setup ---
# Save our starting location before changing directories.
ORIGINAL_DIR="$PWD"
DOCS_DIR="$ORIGINAL_DIR/docs"

# Check if docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: ./docs directory not found!"
    exit 1
fi

# Build the ordered list of documents
echo "--- Building document order based on references ---"
mapfile -t DOCUMENTS < <(build_document_order "$DOCS_DIR")

# Filter out any empty strings from DOCUMENTS array
filtered_docs=()
for doc in "${DOCUMENTS[@]}"; do
    if [ -n "$doc" ]; then
        filtered_docs+=("$doc")
    fi
done
DOCUMENTS=("${filtered_docs[@]}")

echo ""
echo "--- FINAL DOCUMENT ORDER ---"
for i in "${!DOCUMENTS[@]}"; do
    echo "  $((i+1)). ${DOCUMENTS[$i]}"
done
echo ""

# Prepend the directory path to each document
for i in "${!DOCUMENTS[@]}"; do
    DOCUMENTS[$i]="$DOCS_DIR/${DOCUMENTS[$i]}"
done

if [ ${#DOCUMENTS[@]} -eq 0 ]; then
    echo "Error: No markdown files found in ./docs directory!"
    exit 1
fi

# Create a temporary directory and ensure it gets cleaned up on exit.
TMP_DIR=$(mktemp -d)
trap 'echo "--- Cleaning up temporary files ---"; rm -rf "$TMP_DIR"' EXIT

echo "--- Copying documents to temporary directory: $TMP_DIR ---"
cp "${DOCUMENTS[@]}" "$TMP_DIR"

# --- Dynamic File Generation ---
echo "--- Generating title page and page breaks ---"

# Change directory to the temporary location to simplify file operations.
cd "$TMP_DIR"

# 1. Create a title file with YAML metadata.
#    Pandoc will use this to automatically create a title page.
CURRENT_DATE=$(date +"%B %d, %Y")
cat << EOF > 00_title.md
---
title: "$TITLE"
date: "$CURRENT_DATE"
abstract: |
  $ABSTRACT
---
EOF

# 2. Create a file that will force a page break after the table of contents.
echo '\newpage' > 01_break.md

# --- Content Pre-processing ---
echo "--- Removing manual Table of Contents sections ---"

# Remove any section that begins with "## Table of Contents" from each file
for doc_path in "${DOCUMENTS[@]}"; do
  filename=$(basename "$doc_path")
  if [ -f "$filename" ]; then
    # Use awk to remove the ## Table of Contents section and its content
    # This removes from "## Table of Contents" until the next heading of level 2 or higher
    awk '
      /^## Table of Contents/ { skip = 1; next }
      /^#{1,2} / && skip { skip = 0 }
      !skip { print }
    ' "$filename" > "${filename}.tmp" && mv "${filename}.tmp" "$filename"
    echo "  Processed: $filename"
  fi
done

# --- Link Resolution ---
echo "--- Resolving cross-document links ---"

# First, build a mapping of filenames to their H1 heading IDs
declare -A heading_map
for doc_path in "${DOCUMENTS[@]}"; do
  filename=$(basename "$doc_path")
  if [ -f "$filename" ]; then
    h1_text=$(grep -m 1 '^# ' "$filename" | sed 's/^# //')
    if [ -n "$h1_text" ]; then
      # Convert heading text to a valid anchor ID
      heading_id=$(echo "$h1_text" | iconv -f utf-8 -t ascii//translit | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')
      heading_map["$filename"]="$heading_id"
      echo "  Mapping: $filename -> #$heading_id"
    fi
  fi
done

# Now process each file to update links
for file in *.md; do
  if [ -f "$file" ]; then
    # Create a temporary file for safe editing
    temp_file="${file}.link_tmp"
    cp "$file" "$temp_file"
    
    # Replace links to other markdown files
    for source_file in "${!heading_map[@]}"; do
      target_id="${heading_map[$source_file]}"
      # Replace ](./filename.md) and ](filename.md) with ](#heading-id)
      sed "s|](\\./$source_file)|](#$target_id)|g" "$temp_file" > "${temp_file}.2" && mv "${temp_file}.2" "$temp_file"
      sed "s|]($source_file)|](#$target_id)|g" "$temp_file" > "${temp_file}.2" && mv "${temp_file}.2" "$temp_file"
      # Replace ](./filename.md#anchor) and ](filename.md#anchor) with ](#anchor)
      sed "s|](\\./$source_file#|](#|g" "$temp_file" > "${temp_file}.2" && mv "${temp_file}.2" "$temp_file"
      sed "s|]($source_file#|](#|g" "$temp_file" > "${temp_file}.2" && mv "${temp_file}.2" "$temp_file"
    done
    
    # Move the processed file back
    mv "$temp_file" "$file"
    echo "  Processed links in: $file"
  fi
done

# --- PDF Generation ---
echo "--- Running Pandoc to build the PDF ---"

# Get the list of file basenames in the original order for Pandoc.
user_doc_basenames=()
for arg in "${DOCUMENTS[@]}"; do
  user_doc_basenames+=("$(basename "$arg")")
done

# Run the final pandoc command, adding our generated files to the beginning.
pandoc "00_title.md" "01_break.md" "${user_doc_basenames[@]}" \
  --pdf-engine=xelatex \
  -V mainfont="DejaVu Sans" \
  -V sansfont="DejaVu Sans" \
  -V monofont="DejaVu Sans Mono" \
  -V CJKmainfont="Noto Sans CJK JP" \
  -V CJKsansfont="Noto Sans CJK JP" \
  -V CJKmonofont="Noto Sans Mono CJK JP" \
  -V geometry:"margin=0.75in" \
  --table-of-contents \
  --toc-depth=2 \
  --highlight-style=pygments \
  -V colorlinks=true \
  -V linkcolor=blue \
  -V urlcolor=blue \
  -V toccolor=black \
  --include-in-header=<(echo "
\\usepackage{tcolorbox}
\\usepackage{fvextra}

\\tcbuselibrary{skins,breakable}

\\newtcolorbox{mycolorbox}{
  colback=gray!10,
  colframe=gray!50,
  boxrule=1pt,
  arc=4pt,
  left=10pt,
  right=10pt,
  top=10pt,
  bottom=10pt,
  breakable,
  enhanced
}

\\renewenvironment{Shaded}{
  \\begin{mycolorbox}
}{
  \\end{mycolorbox}
}

\\DefineVerbatimEnvironment{Highlighting}{Verbatim}{
  breaklines,
  breakanywhere=false,
  breaksymbol=,
  commandchars=\\\\\\{\\}
}
") \
  -o "$ORIGINAL_DIR/docs/$OUTPUT_PDF"

echo ""
echo "✅ Success! PDF created at: $ORIGINAL_DIR/docs/$OUTPUT_PDF"