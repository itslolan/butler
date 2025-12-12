import { NextRequest, NextResponse } from 'next/server';
import { 
  getBudgetCategories, 
  addCustomCategory, 
  deleteCategory,
  initializeBudgetCategories 
} from '@/lib/budget-utils';

export const runtime = 'nodejs';

/**
 * GET /api/budget/categories
 * Get all budget categories for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    let categories = await getBudgetCategories(userId);

    // If no categories, initialize them
    if (categories.length === 0) {
      categories = await initializeBudgetCategories(userId);
    }

    return NextResponse.json({ categories });

  } catch (error: any) {
    console.error('Error getting categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget/categories
 * Add a new custom category
 * Body: { userId, name }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const category = await addCustomCategory(userId, name);

    return NextResponse.json({ 
      success: true, 
      category: {
        id: category.id,
        name: category.name,
        isCustom: category.is_custom,
      }
    });

  } catch (error: any) {
    console.error('Error adding category:', error);
    
    // Check for duplicate error
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to add category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/budget/categories
 * Delete a category (only if no transactions use it)
 * Query params: userId, categoryId
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryId = searchParams.get('categoryId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    await deleteCategory(userId, categoryId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting category:', error);
    
    // Check for delete protection error
    if (error.message.includes('Cannot delete category')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}

