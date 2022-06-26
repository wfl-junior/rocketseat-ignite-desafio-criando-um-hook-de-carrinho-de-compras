import { createContext, ReactNode, useContext, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../services/api";
import { Product, Stock } from "../types";

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

const localStorageKey = "@RocketShoes:cart";

function updateLocalStorageCart(cart: Product[]) {
  localStorage.setItem(localStorageKey, JSON.stringify(cart));
}

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const localStorageCart = localStorage.getItem(localStorageKey);

    if (localStorageCart) {
      return JSON.parse(localStorageCart);
    }

    return [];
  });

  const addProduct = async (productId: number) => {
    try {
      const existingProduct = cart.find(product => product.id === productId);

      // adiciona produto ao carrinho se não existir no carrinho
      if (!existingProduct) {
        const { data } = await api.get<Omit<Product, "amount">>(
          `/products/${productId}`,
        );

        return setCart(products => {
          const newState = [
            ...products,
            {
              ...data,
              amount: 1,
            },
          ];

          updateLocalStorageCart(newState);
          return newState;
        });
      }

      // adciona um na quantidade do produto se já existir no carrinho
      await updateProductAmount({
        productId: existingProduct.id,
        amount: existingProduct.amount + 1,
      });
    } catch {
      toast.error("Erro na adição do produto");
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const existingProduct = cart.find(product => product.id === productId);

      if (!existingProduct) {
        throw new Error("product does not exist in cart");
      }

      setCart(products => {
        const newState = products.filter(product => product.id !== productId);
        updateLocalStorageCart(newState);
        return newState;
      });
    } catch (error) {
      toast.error("Erro na remoção do produto");
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    if (amount < 1) {
      return;
    }

    try {
      const {
        data: { amount: amountInStock },
      } = await api.get<Stock>(`/stock/${productId}`);

      if (amount > amountInStock) {
        toast.error("Quantidade solicitada fora de estoque");
        return;
      }

      setCart(products => {
        const newState = products.map(product => {
          if (product.id === productId) {
            return {
              ...product,
              amount,
            };
          }

          return product;
        });

        updateLocalStorageCart(newState);
        return newState;
      });
    } catch {
      toast.error("Erro na alteração de quantidade do produto");
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
