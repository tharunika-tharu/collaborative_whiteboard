import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context";
import "./Whiteboard.css";
import {
  Stage,
  Layer,
  Ellipse,
  Rect,
  Line,
  Arrow,
  Star,
  Ring,
  Arc,
  Text,
  Label,
  Transformer,
  Tag,
  Image as KonvaImage,
  Group,
} from "react-konva";
import { ACTIONS } from "./constants";
import { useAuth0 } from "@auth0/auth0-react";
// import useImage from "react-use-image";

function Whiteboard({ users, isAdmin }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const layerRef = useRef(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundTiles, setBackgroundTiles] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef(null);
  const transformerRef = useRef();
  const stageRef = useRef();
  const Id = useSocket();
  const { user } = useAuth0();

  const [otherUsersPointers, setOtherUsersPointers] = useState({});
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [action, setAction] = useState(ACTIONS.SELECT);
  const [fillColor, setFillColor] = useState("#ff0000");
  const [strokeColor, setStrokeColor] = useState("#000");
  const [shapes, setShapes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [target, setTarget] = useState(null);
  const isDraggable = action === ACTIONS.SELECT;

  // Undo/Redo states
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const getUserColor = (username) => {
    const colors = [
      "#1abc9c",
      "#3498db",
      "#9b59b6",
      "#e74c3c",
      "#f39c12",
      "#2ecc71",
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  const handleSelectChange = (changeProperty) => {
    console.log(action, target);
    if (action === ACTIONS.SELECT && target) {
      let shapeIndex = shapes.findIndex((shape) => shape.id === target.id());

      if (shapeIndex === -1) {
        if (target.parent) {
          shapeIndex = shapes.findIndex(
            (shape) => shape.id === target.parent.id()
          );
        }
      }
      if (shapeIndex === -1) return;
      let updatedShape;
      if (changeProperty === "fillColor") {
        updatedShape = {
          ...shapes[shapeIndex],
          fillColor: fillColor,
        };
      } else if (changeProperty === "strokeWidth") {
        updatedShape = {
          ...shapes[shapeIndex],
          strokeWidth: strokeWidth,
          fontSize: strokeWidth + 5,
        };
      } else {
        updatedShape = {
          ...shapes[shapeIndex],
          strokeColor: strokeColor,
        };
      }
      console.log(updatedShape);
      const updatedShapes = shapes.map((shape, index) =>
        index === shapeIndex ? updatedShape : shape
      );
      setShapes(updatedShapes);

      Id.socket.emit("shapeUpdated", { shapes: shapes }, Id.roomId);
    }
  };
  const [actionImages, setActionImages] = useState({});

  useEffect(() => {
    const loadActionImages = async () => {
      const images = {
        [ACTIONS.SELECT]: await loadImage("/images/arrow-pointer-solid.svg"),
        [ACTIONS.CIRCLE]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.ELLIPSE]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.RECTANGLE]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.SCRIBBLE]: await loadImage("/images/pen-solid.svg"),
        [ACTIONS.ARROW]: await loadImage("/images/pen-solid.svg"),
        [ACTIONS.STAR]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.RING]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.ARC]: await loadImage("/images/crosshairs-solid.svg"),
        [ACTIONS.TEXT]: await loadImage("/images/i-cursor-solid.svg"),
        [ACTIONS.LABEL]: await loadImage("/images/i-cursor-solid.svg"),
        [ACTIONS.LINE]: await loadImage("/images/pen-solid.svg"),
        [ACTIONS.DRAG]: await loadImage("/images/hand-regular.svg"),
      };
      setActionImages(images);
    };

    loadActionImages();
  }, []);

  useEffect(() => {
    Id.socket.on("pointerPositionUpdate", (obj) => {
      console.log(obj.message.email);
      if (obj.message.email) {
        setOtherUsersPointers((prevState) => ({
          ...prevState,
          [obj.message.email]: {
            x: obj.message.x,
            y: obj.message.y,
            action: obj.message.action,
          },
        }));
      }
    });

    return () => {
      Id.socket.off("pointerPositionUpdate");
    };
  }, [Id.socket]);

  useEffect(() => {
    handleSelectChange("fillColor");
  }, [fillColor]);
  useEffect(() => {
    handleSelectChange("strokeWidth");
  }, [strokeWidth]);

  useEffect(() => {
    handleSelectChange("strokeColor");
  }, [strokeColor]);

  useEffect(() => {
    imageLoaded &&
      backgroundImage &&
      setBackgroundTiles(renderTiledBackground());
    console.log("inside handleDragMove useEffect");
  }, [position, scale, imageLoaded, backgroundImage]);

  useEffect(() => {
    window.addEventListener("keydown", keyDownHandler);

    return () => {
      window.removeEventListener("keydown", keyDownHandler);
    };
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = process.env.PUBLIC_URL + "/images/gridImage.png";

    img.crossOrigin = "Anonymous";
    img.onload = () => {
      setBackgroundImage(img);
      setImageLoaded(true);
      if (layerRef.current) {
        layerRef.current.batchDraw();
      }
    };

    img.onerror = () => {
      console.error("Failed to load the image.");
    };
  }, []);

  useEffect(() => {
    setDeleteItem(null);
    setTarget(null);
  }, [action]);

  useEffect(() => {
    document
      .querySelectorAll(".icon-btn")
      ?.forEach((btn) => btn?.classList.remove("active"));

    if (action) {
      document.getElementById(`${action}`)?.classList.add("active");
    }

    Object.values(ACTIONS).forEach((act) => {
      document.getElementById("whiteboard")?.classList.remove(act);
    });

    if (action && action === action.toUpperCase()) {
      document.getElementById("whiteboard")?.classList.add(action);
    }
  }, [action]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Receiving and Handling Shapes from Socket.io
  useEffect(() => {
    Id.socket.on("shapeCreated", ({ shape }) => {
      if (shape.type === "image") {
        const img = new window.Image();
        img.src = shape.src; // Use the base64 string to load the image

        img.onload = () => {
          const newImage = {
            ...shape,
            image: img,
            nodeRef: React.createRef(),
          };

          setShapes((prevShapes) => [...prevShapes, newImage]);
        };

        img.onerror = () => {
          console.error("Error loading image on the receiving side");
        };

        return;
      }

      // Handle non-image shapes
      const newShape = {
        ...shape,
        nodeRef: React.createRef(),
      };

      setShapes((prevShapes) => [...prevShapes, newShape]);
    });

    // Listen for updated shapes
    Id.socket.on("shapeUpdated", ({ shapes }) => {
      const updatedShapes = shapes.map((shape) => ({
        ...shape,
        nodeRef:
          shapes.find((s) => s.id === shape.id)?.nodeRef || React.createRef(), // Maintain the original nodeRef
      }));
      setShapes(updatedShapes);
    });

    // Listen for selection box updates
    Id.socket.on("selectionBoxUpdate", ({ selectionBox }) => {
      setSelectionBox(selectionBox);
    });

    // Listen for selection completion
    Id.socket.on("selectionComplete", ({ selectedShapes }) => {
      const updatedSelectedShapes = selectedShapes.map((shape) => ({
        ...shape,
        nodeRef:
          shapes.find((s) => s.id === shape.id)?.nodeRef || React.createRef(), // Maintain the original nodeRef
      }));
      transformerRef.current.nodes(
        updatedSelectedShapes.map((shape) => shape.nodeRef.current)
      );
      transformerRef.current.getLayer().batchDraw();
      setSelectionBox(null);
    });

    // Listen for text updates
    Id.socket.on("textUpdated", ({ shapeId, text }) => {
      setShapes((prevShapes) =>
        prevShapes.map((shape) => {
          if (shape.id === shapeId) {
            return { ...shape, text };
          }
          return shape;
        })
      );
    });
    Id.socket.on("clearShapes", () => {
      setShapes([]);
    });

    // Listen for shape transformation (resize, rotate) from others
    Id.socket.on("shapeTransformed", ({ updatedShape }) => {
      setShapes((prevShapes) =>
        prevShapes.map((shape) => {
          if (shape.id === updatedShape.id) {
            return {
              ...shape,
              x: updatedShape.x,
              y: updatedShape.y,
              width: updatedShape.width,
              height: updatedShape.height,
              points: updatedShape.points,
              fillColor: updatedShape.fillColor,
              strokeColor: updatedShape.strokeColor,
              tool: updatedShape.tool,
              text: updatedShape.tool,
            };
          } else {
            return shape;
          }
        })
      );
    });

    // Listen for shape drag from others
    Id.socket.on("shapeDragged", ({ updatedShape }) => {
      if (updatedShape.type === "image") {
        const img = new window.Image();
        img.src = updatedShape.src; // Use the base64 string to load the image

        img.onload = () => {
          setShapes((prevShapes) =>
            prevShapes.map((shape) => {
              if (shape.id === updatedShape.id) {
                return {
                  ...shape,
                  image: img,
                  x: updatedShape.x,
                  y: updatedShape.y,
                  width: updatedShape.width,
                  height: updatedShape.height,
                  points: updatedShape.points,
                  fillColor: updatedShape.fillColor,
                  strokeColor: updatedShape.strokeColor,
                  tool: updatedShape.tool,
                  text: updatedShape.tool,
                };
              } else {
                return shape;
              }
            })
          );
        };

        img.onerror = () => {
          console.error("Error loading image on the receiving side");
        };

        // Early return to avoid executing the rest of the code for images
        return;
      }
      setShapes((prevShapes) =>
        prevShapes.map((shape) => {
          if (shape.id === updatedShape.id) {
            return {
              ...shape,
              x: updatedShape.x,
              y: updatedShape.y,
              width: updatedShape.width,
              height: updatedShape.height,
              points: updatedShape.points,
              fillColor: updatedShape.fillColor,
              strokeColor: updatedShape.strokeColor,
              tool: updatedShape.tool,
              text: updatedShape.tool,
            };
          } else {
            return shape;
          }
        })
      );
    });

    Id.socket.on(
      "undo",
      ({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        shapes: newShapes,
      }) => {
        // Update the local stacks and shapes with the received data
        setUndoStack(newUndoStack);
        setRedoStack(newRedoStack);
        setShapes(newShapes);
      }
    );

    // Listen for redo events
    Id.socket.on(
      "redo",
      ({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        shapes: newShapes,
      }) => {
        // Update the local stacks and shapes with the received data
        setUndoStack(newUndoStack);
        setRedoStack(newRedoStack);
        setShapes(newShapes);
      }
    );

    Id.socket.on("shapesChange", ({ shapes: newShapes }) => {
      const updatedShapes = newShapes.map((shape) => ({
        ...shape,
        nodeRef:
          shapes.find((s) => s.id === shape.id)?.nodeRef || React.createRef(), // Maintain the original nodeRef
      }));
      setUndoStack([...undoStack, updatedShapes]);
      setShapes(updatedShapes);
      setRedoStack([]);
    });

    return () => {
      Id.socket.off("shapesChange");
      Id.socket.off("undo");
      Id.socket.off("redo");
      Id.socket.off("shapeCreated");
      Id.socket.off("shapeUpdated");
      Id.socket.off("selectionBoxUpdate");
      Id.socket.off("selectionComplete");
      Id.socket.off("textUpdated");
      Id.socket.off("clearShapes");
      Id.socket.off("shapeTransformed");
      Id.socket.off("shapeDragged");
    };
  }, [shapes]);

  useEffect(() => {
    shapes.forEach((shape) => {
      const node = shape.nodeRef.current;
      if (node && shape.tool !== "IMAGE") {
        node.on("transform", handleOnTransform);
        node.on("dragmove", handleOnDragMove);
      }
    });

    return () => {
      shapes.forEach((shape) => {
        const node = shape.nodeRef.current;
        if (node && shape.tool !== "IMAGE") {
          node.off("transform", handleOnTransform);
          node.off("dragmove", handleOnDragMove);
        }
      });
    };
  }, [shapes]);

  useEffect(() => {
    // Listen canvas zoom updates from other users
    Id.socket.on("updateCanvasZoom", ({ scale, position }) => {
      const stage = stageRef.current;

      // received scale and position
      stage.scale({ x: scale, y: scale });
      stage.position(position);
      stage.batchDraw();
    });

    // Listen canvas drag updates from other users
    Id.socket.on("updateCanvasDrag", ({ position }) => {
      const stage = stageRef.current;

      //received position
      stage.position(position);
      stage.batchDraw();
    });

    // Clean up event listeners on component unmount
    return () => {
      Id.socket.off("updateCanvasZoom");
      Id.socket.off("updateCanvasDrag");
    };
  }, []);

  const handleUserAction = (adminAction) => {
    if (!selectedUser) return; // Ensure a user is selected before proceeding

    switch (adminAction) {
      case "call":
        break;

      case "quitCall":
        break;

      case "grantPermission": {
        Id.socket.emit("shapeUpdated", { shapes: shapes }, Id.roomId);
        Id.socket.emit("grantPermission", selectedUser); // Grant permission to selected user
        break;
      }

      case "revokePermission": {
        Id.socket.emit("revokePermission", selectedUser); // Revoke permission from selected user
        break;
      }

      case "kickUser": {
        Id.socket.emit("disconnectUser", Id.roomId, selectedUser.socketId); // Disconnect selected user
        break;
      }

      default:
        break;
    }
  };

  const handleUndo = () => {
    if (undoStack.length < 2) return; // Ensure at least two states exist

    // Get the second-to-last state and the last state
    const previousState = undoStack[undoStack.length - 2];
    const lastState = undoStack[undoStack.length - 1];

    // Update the redo stack
    setRedoStack((prevRedoStack) => [lastState, ...prevRedoStack]);

    // Update the shapes to the previous state
    setShapes(previousState);

    // Update the undo stack
    setUndoStack((prevUndoStack) => prevUndoStack.slice(0, -1));

    Id.socket.emit(
      "undo",
      {
        undoStack: undoStack.slice(0, -1),
        redoStack: [lastState, ...redoStack],
        shapes: previousState,
      },
      Id.roomId
    );
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return; // Ensure there's something to redo

    const nextState = redoStack[0]; // Get the next state to restore

    // Update undo stack with the current state
    setUndoStack([...undoStack, nextState]);

    // Update shapes to the next state
    setShapes(nextState);

    // Update redo stack by removing the first state
    setRedoStack(redoStack.slice(1));

    Id.socket.emit(
      "redo",
      {
        undoStack: [...undoStack, nextState],
        redoStack: redoStack.slice(1),
        shapes: nextState,
      },
      Id.roomId
    );
  };

  // Pointer Down Event
  let startShapes;
  const onPointerDown = (e) => {
    const { x, y } = stageRef.current.getRelativePointerPosition();
    Id.socket.emit(
      "pointerPosition",
      { x, y, action, email: user.email },
      Id.roomId
    );
    if (action === ACTIONS.DRAG) return;
    startShapes = [...shapes];

    setIsDrawing(true);

    if (action === ACTIONS.GROUPSELECT) {
      const initialSelectionBox = { x, y, width: 0, height: 0 };
      setSelectionBox(initialSelectionBox);

      // Emit initial selection box to the server
      Id.socket.emit(
        "selectionBoxUpdate",
        { selectionBox: initialSelectionBox },
        Id.roomId
      );
    } else if (
      action !== ACTIONS.SELECT &&
      action !== ACTIONS.TEXT &&
      action !== ACTIONS.LABEL
    ) {
      const shape = {
        id: `${action}-${Date.now()}`,
        x,
        y,
        width: action === ACTIONS.TEXT || action === ACTIONS.LABEL ? 150 : 0,
        height: action === ACTIONS.TEXT || action === ACTIONS.LABEL ? 50 : 0,
        points: [x, y, x, y],
        fillColor,
        strokeColor,
        strokeWidth,
        tool: action,
        text: action === ACTIONS.TEXT ? "Sample Text" : "",
        fontSize: 20,
        nodeRef: React.createRef(), // Initialize nodeRef once when the shape is created
      };
      setShapes([...shapes, shape]);

      // Emit new shape to other users without nodeRef
      Id.socket.emit(
        "shapeCreated",
        { shape: { ...shape, nodeRef: null } },
        Id.roomId
      );
    }
  };

  // Pointer Move Event
  const onPointerMove = (e) => {
    const { x, y } = stageRef.current.getRelativePointerPosition();
    Id.socket.emit(
      "pointerPosition",
      { x, y, action, email: user.email },
      Id.roomId
    );
    if (!isDrawing) return;

    // const { x, y } = e.target.getStage().getPointerPosition();
    if (action === ACTIONS.GROUPSELECT && selectionBox) {
      const updatedBox = {
        ...selectionBox,
        width: x - selectionBox.x,
        height: y - selectionBox.y,
      };
      setSelectionBox(updatedBox);

      // Emit updated selection box while dragging
      Id.socket.emit(
        "selectionBoxUpdate",
        { selectionBox: updatedBox },
        Id.roomId
      );
    } else if (shapes.length !== 0 && action !== ACTIONS.SELECT) {
      const updatedShapes = shapes.map((shape, index) => {
        if (index === shapes.length - 1) {
          if (shape.tool === ACTIONS.LINE || shape.tool === ACTIONS.ARROW) {
            shape.points = [shape.x, shape.y, x, y];
          } else if (shape.tool === ACTIONS.SCRIBBLE) {
            shape.points = [...shape.points, x, y];
          } else if (action !== ACTIONS.TEXT && action !== ACTIONS.LABEL) {
            shape.width = x - shape.x;
            shape.height = y - shape.y;
          }
        }
        return shape;
      });
      setShapes(updatedShapes);

      // Emit updated shapes without nodeRef
      Id.socket.emit(
        "shapeUpdated",
        { shapes: updatedShapes.map((s) => ({ ...s, nodeRef: null })) },
        Id.roomId
      );
    }
  };

  // Pointer Up Event
  const onPointerUp = () => {
    setIsDrawing(false);
    // Check if the current state differs from the start state
    const shapesChanged =
      JSON.stringify(startShapes) !== JSON.stringify(shapes);

    if (shapesChanged) {
      // If shapes have changed, push the current state to the undo stack
      let newUndoStack;
      newUndoStack = [...undoStack, shapes];
      setUndoStack(newUndoStack);
      setRedoStack([]); // Clear redo stack after a new change
      Id.socket.emit("shapesChange", { shapes }, Id.roomId);
    }
    if (action === ACTIONS.GROUPSELECT && selectionBox) {
      const selectedShapes = shapes.filter((shape) => {
        const shapeBounds = {
          x1: shape.x,
          y1: shape.y,
          x2: shape.x + (shape.width || 0),
          y2: shape.y + (shape.height || 0),
        };
        const selectionBounds = {
          x1: Math.min(selectionBox.x, selectionBox.x + selectionBox.width),
          y1: Math.min(selectionBox.y, selectionBox.y + selectionBox.height),
          x2: Math.max(selectionBox.x, selectionBox.x + selectionBox.width),
          y2: Math.max(selectionBox.y, selectionBox.y + selectionBox.height),
        };

        return (
          shapeBounds.x1 >= selectionBounds.x1 &&
          shapeBounds.y1 >= selectionBounds.y1 &&
          shapeBounds.x2 <= selectionBounds.x2 &&
          shapeBounds.y2 <= selectionBounds.y2
        );
      });

      transformerRef.current.nodes(
        selectedShapes.map((shape) => shape.nodeRef.current)
      );
      transformerRef.current.getLayer().batchDraw();

      Id.socket.emit(
        "selectionComplete",
        {
          selectedShapes: selectedShapes.map((s) => ({ ...s, nodeRef: null })),
        },
        Id.roomId
      );

      setSelectionBox(null);
    }

    if (shapes.length > 0) {
      const lastShape = shapes[shapes.length - 1];
      if (
        lastShape.tool !== "ARROW" &&
        lastShape.tool !== "LINE" &&
        lastShape.tool !== "SCRIBBLE" &&
        lastShape.width === 0 &&
        lastShape.height === 0
      ) {
        setShapes(shapes.slice(0, -1));
      }
    }
  };

  const onClick = (e) => {
    const target = e.target;
    console.log(target);
    setTarget(target);
    if (!target.id()) {
      setDeleteItem(target.parent?.id());
    }
    if (target.id()) setDeleteItem(target.id());
    const { x, y } = stageRef.current.getRelativePointerPosition();
    if (
      action !== ACTIONS.SELECT &&
      (action === ACTIONS.TEXT || action === ACTIONS.LABEL)
    ) {
      const shape = {
        id: `${action}-${Date.now()}`,
        x,
        y,
        width: action === ACTIONS.TEXT || action === ACTIONS.LABEL ? 150 : 0,
        height: action === ACTIONS.TEXT || action === ACTIONS.LABEL ? 50 : 0,
        points: [x, y, x, y],
        fillColor,
        strokeColor,
        strokeWidth,
        tool: action,
        text: action === ACTIONS.TEXT ? "Sample Text" : "",
        fontSize: 20,
        nodeRef: React.createRef(), // Initialize nodeRef once when the shape is created
      };
      setShapes([...shapes, shape]);

      // Emit new shape to other users without nodeRef
      Id.socket.emit(
        "shapeCreated",
        { shape: { ...shape, nodeRef: null } },
        Id.roomId
      );
    }
    if (action === ACTIONS.SELECT) {
      transformerRef.current.nodes([]);
      if (target.attrs.image) return;
      let shapeIndex = shapes.findIndex((shape) => shape.id === target.id());
      if (shapeIndex === -1) {
        if (target.parent) {
          shapeIndex = shapes.findIndex(
            (shape) => shape.id === target.parent.id()
          );
        }
      }
      if (shapeIndex === -1) return;
      const selectedShape = shapes[shapeIndex];
      const updatedShapes = [
        ...shapes.filter((_, index) => index !== shapeIndex), // Exclude the selected shape
        selectedShape, // Add the selected shape at the end (which will be on top)
      ];

      // Update state with the new shapes order
      setShapes(updatedShapes);

      // Attach the transformer to the selected shape
      transformerRef.current.nodes([target]);
      transformerRef.current.getLayer().batchDraw(); // Redraw the layer
    } else {
      return;
    }
    Id.socket.emit("onClick", { shapes, target }, Id.roomId);
  };

  const handleDoubleClick = (e) => {
    // Get the target shape
    setAction(ACTIONS.SELECT);
    const target = e.target.getParent(); // Get the parent Label
    let shapeId = target.id(); // Get the ID from the Label
    if (!shapeId) {
      shapeId = e.target.id();
    }
    console.log("Double-clicked shape ID:", shapeId); // Log the shape ID

    const shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    const shape = shapes[shapeIndex];

    if (shape?.tool === ACTIONS.TEXT) {
      setEditingText(shapeId);
      setTextInput(shape.text || "");
      Id.socket.emit("textUpdated", { shapeId, text: shape.text }, Id.roomId);
    } else if (shape?.tool === ACTIONS.LABEL) {
      setEditingText(shapeId);
      setTextInput(shape.text || "");
      Id.socket.emit("textUpdated", { shapeId, text: shape.text }, Id.roomId);
    }
  };

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
  };

  // Handle text blur and update shape text
  const handleTextBlur = () => {
    const shapeIndex = shapes.findIndex((shape) => shape.id === editingText);
    if (shapeIndex !== -1) {
      const updatedShapes = shapes.map((shape, index) => {
        if (index === shapeIndex) {
          return { ...shape, text: textInput };
        }
        return shape;
      });
      setShapes(updatedShapes);
      Id.socket.emit(
        "textUpdated",
        { shapeId: editingText, text: textInput },
        Id.roomId
      );
    }
    setEditingText(null);
    setTextInput("");
  };

  const handleOnTransform = (e) => {
    const node = e.target;
    console.log(node);
    const shapeId = node.id();
    let shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    console.log(shapeIndex);
    if (shapeIndex === -1) {
      if (node.parent) {
        shapeIndex = shapes.findIndex((shape) => shape.id === node.parent.id());
      }
    }
    if (shapeIndex === -1) return;
    node.rotation(0);
    if (
      shapes[shapeIndex].tool == "CIRCLE" ||
      shapes[shapeIndex].tool == "ELLIPSE" ||
      shapes[shapeIndex].tool == "RECTANGLE" ||
      shapes[shapeIndex].tool == "TEXT" ||
      shapes[shapeIndex].tool == "LABEL"
    ) {
      // Get the current scale factors
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Prepare the updated shape object
      let updatedShape = {
        ...shapes[shapeIndex],
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: scaleX, // Store the current scale factors
        scaleY: scaleY,
      };
      if (
        shapes[shapeIndex].tool === "TEXT" ||
        shapes[shapeIndex].tool === "LABEL"
      ) {
        updatedShape.text = node.text(); // Ensure the text content is preserved
        updatedShape.width = node.width() * scaleX; // Update width
        updatedShape.height = node.height() * scaleY; // Update height
      }
      // Handle scaling for different shapes
      if (
        node.width &&
        node.height &&
        shapes[shapeIndex].tool === "RECTANGLE"
      ) {
        updatedShape.width = node.width() * scaleX;
        updatedShape.height = node.height() * scaleY;
      }

      if (node.radius) {
        updatedShape.radius = node.radius() * Math.max(scaleX, scaleY);
      }

      if (node.radiusX && node.radiusY) {
        updatedShape.radiusX = node.radiusX() * scaleX;
        updatedShape.radiusY = node.radiusY() * scaleY;
      }

      if (node.points) {
        const newPoints = node
          .points()
          .map((point, index) =>
            index % 2 === 0 ? point * scaleX : point * scaleY
          );
        updatedShape.points = newPoints;
      }

      if (node.innerRadius && node.outerRadius) {
        updatedShape.innerRadius = node.innerRadius() * scaleX;
        updatedShape.outerRadius = node.outerRadius() * scaleY;
      }

      // Update the shape in the state
      const updatedShapes = shapes.map((shape, index) =>
        index === shapeIndex ? updatedShape : shape
      );
      setShapes(updatedShapes);

      // Emit the updated shape with the current scale
      Id.socket.emit("shapeTransformed", { updatedShape }, Id.roomId);
    } else {
      node.x(shapes[shapeIndex].x);
      node.y(shapes[shapeIndex].y);
      node.scaleX(1);
      node.scaleY(1);
    }
  };
  const handleTransformEnd = (e) => {
    console.log("Inside handleTransformEnd");
    const node = e.target;
    const shapeId = node.id();
    let shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    if (shapeIndex === -1) {
      if (node.parent) {
        shapeIndex = shapes.findIndex((shape) => shape.id === node.parent.id());
      }
    }
    if (shapeIndex === -1) return;
    node.rotation(0);

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    let updatedShape = {
      ...shapes[shapeIndex],
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: scaleX,
      scaleY: scaleY,
    };
    const updatedShapes = shapes.map((shape, index) =>
      index === shapeIndex ? updatedShape : shape
    );
    setShapes(updatedShapes);

    Id.socket.emit("shapeTransformed", { updatedShape }, Id.roomId);
  };
  // Listen for dragging (moving shapes)
  const handleOnDragMove = (e) => {
    console.log("inside handleOnDragMove");
    const node = e.target;
    const shapeId = node.id();
    let shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    if (shapeIndex === -1) {
      if (node.parent) {
        shapeIndex = shapes.findIndex((shape) => shape.id === node.parent.id());
      }
    }
    if (shapeIndex === -1) return;
    if (shapes[shapeIndex].tool === "IMAGE") return;

    const updatedShape = {
      ...shapes[shapeIndex],
      x: node.x(),
      y: node.y(),
    };

    const updatedShapes = shapes.map((shape, index) =>
      index === shapeIndex ? updatedShape : shape
    );

    setShapes(updatedShapes);
    Id.socket.emit("shapeDragged", { updatedShape }, Id.roomId);
  };
  const handleDragEnd = (e) => {
    console.log("Inside handleDragEnd");
    const node = e.target;
    const shapeId = node.id();
    let shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    if (shapeIndex === -1) {
      if (node.parent) {
        shapeIndex = shapes.findIndex((shape) => shape.id === node.parent.id());
      }
    }
    if (shapeIndex === -1) return;
    const updatedShape = {
      ...shapes[shapeIndex],
      x: node.x(),
      y: node.y(),
    };

    const updatedShapes = shapes.map((shape, index) =>
      index === shapeIndex ? updatedShape : shape
    );

    setShapes(updatedShapes);
    Id.socket.emit("shapeDragged", { updatedShape }, Id.roomId);
  };
  const handleDownload = () => {
    const dataURL = stageRef.current.toDataURL();

    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "canvas-image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTiledBackground = () => {
    const tileWidth = backgroundImage.width; // Original image width
    const tileHeight = backgroundImage.height; // Original image height
    const tiles = [];

    for (let x = -10010; x < 10000; x += tileWidth) {
      for (let y = -10010; y < 10000; y += tileHeight) {
        tiles.push(
          <KonvaImage
            key={`${x}-${y}`}
            image={backgroundImage}
            width={tileWidth}
            height={tileHeight}
            x={x}
            y={y}
            scaleX={1}
            scaleY={1}
          />
        );
      }
    }

    return tiles;
  };

  const drawShape = (shape) => {
    const {
      id,
      x,
      y,
      width,
      height,
      points,
      tool,
      fillColor,
      strokeColor,
      nodeRef,
      text,
      radiusX,
      radiusY,
      innerRadius,
      outerRadius,
      strokeWidth,
      fontSize,
      src,
    } = shape;
    switch (tool) {
      case ACTIONS.IMAGE: {
        return null;
        // <KonvaImage
        //   key={id}
        //   id={id}
        //   src={src}
        //   crossOrigin="Anonymous"
        //   x={x}
        //   y={y}
        //   image={shape.image}
        //   width={width}
        //   height={height}
        //   draggable={isDraggable}
        //   onClick={onClick}
        //   onTransformEnd={handleTransformEnd}
        //   onDragEnd={handleDragEnd}
        //   ref={nodeRef}
        // />
      }
      case ACTIONS.CIRCLE:
        return (
          <Ellipse
            key={id}
            id={id}
            x={x}
            y={y}
            radiusX={radiusX ? radiusX : Math.abs(width)}
            radiusY={radiusY ? radiusY : Math.abs(width)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.ELLIPSE:
        return (
          <Ellipse
            key={id}
            id={id}
            x={x}
            y={y}
            radiusX={radiusX ? radiusX : Math.abs(width)}
            radiusY={radiusY ? radiusY : Math.abs(height)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.RECTANGLE:
        return (
          <Rect
            key={id}
            id={id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.LINE:
        return (
          <Line
            key={id}
            id={id}
            points={points}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.ARROW:
        return (
          <Arrow
            key={id}
            id={id}
            points={points}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.STAR:
        return (
          <Star
            key={id}
            id={id}
            x={x}
            y={y}
            numPoints={3}
            innerRadius={innerRadius ? innerRadius : Math.abs(width)}
            outerRadius={outerRadius ? outerRadius : Math.abs(height)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.RING:
        return (
          <Ring
            key={id}
            id={id}
            x={x}
            y={y}
            innerRadius={innerRadius ? innerRadius : Math.abs(width / 2)}
            outerRadius={outerRadius ? outerRadius : Math.abs(width)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.ARC:
        return (
          <Arc
            key={id}
            id={id}
            x={x}
            y={y}
            innerRadius={innerRadius ? innerRadius : Math.abs(width / 2)}
            outerRadius={outerRadius ? outerRadius : Math.abs(width)}
            angle={120}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      case ACTIONS.TEXT:
        return (
          <Text
            key={id}
            id={id}
            x={x}
            y={y}
            text={text || "Sample Text"}
            fontSize={fontSize}
            width={width ? width : undefined}
            height={height ? height : undefined}
            fill={strokeColor}
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
            onDblClick={handleDoubleClick}
          />
        );
      case ACTIONS.LABEL:
        return (
          <Group key={id} id={id} ref={nodeRef} onDblClick={handleDoubleClick}>
            <Rect
              x={x}
              y={y}
              fill={fillColor}
              width={width ? width : undefined}
              height={height ? height : undefined}
            />
            <Text
              x={x}
              y={y}
              text={text || "Label Text"}
              fontSize={fontSize}
              width={width ? width : undefined}
              height={height ? height : undefined}
              fill={strokeColor}
              onTransform={handleOnTransform}
              onDragMove={handleOnDragMove}
              draggable={isDraggable}
              onClick={onClick}
            />
          </Group>
        );

      case ACTIONS.SCRIBBLE:
        return (
          <Line
            key={id}
            id={id}
            points={points}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            draggable={isDraggable}
            onClick={onClick}
            onTransform={handleOnTransform}
            onDragMove={handleOnDragMove}
            ref={nodeRef}
          />
        );
      default:
        return null;
    }
  };

  const clearHandler = (e) => {
    setShapes([]);
    transformerRef.current.nodes([]);
    Id.socket.emit("clearShapes", Id.roomId);
  };

  const scaleBy = 0.09; // Zoom factor
  const MIN_ZOOM = 0.7;
  const MAX_ZOOM = 1.4;

  // Emit to socket when zooming
  const handleWheel = (e) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const finalScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    stage.scale({ x: finalScale, y: finalScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * finalScale,
      y: pointer.y - mousePointTo.y * finalScale,
    };

    setPosition(newPos);
    setScale(finalScale);
    Id.socket.emit(
      "canvasZoomed",
      { scale: finalScale, position: newPos },
      Id.roomId
    );
    setBackgroundTiles(renderTiledBackground());
    stage.position(newPos);
    stage.batchDraw();
  };

  const handleDragMove = (e) => {
    const stage = stageRef.current;

    const { x, y } = stage.position();

    const newPos = { x, y };
    if (stage) {
      setPosition(newPos);
    }
    Id.socket.emit("canvasDragged", { position: newPos }, Id.roomId);
    console.log("inside handleDragMove");
    setBackgroundTiles(renderTiledBackground());
    stage.position(newPos);
    stage.batchDraw();
  };

  const deleteShape = () => {
    if (action === ACTIONS.SELECT) {
      const updatedShapes = shapes.filter((shape) => shape.id !== deleteItem);

      setShapes(updatedShapes);
      transformerRef.current.nodes([]);
      Id.socket.emit("shapeUpdated", { shapes: updatedShapes }, Id.roomId);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      let newImage = {};
      reader.onload = () => {
        const img = new window.Image();
        img.src = reader.result;
        img.onload = () => {
          newImage = {
            id: `image-${shapes.length + 1}`,
            type: "image",
            image: img,
            src: reader.result, // Set the image src to the data URL
            width: 200,
            height: 200,
            x: 50,
            y: 50,
            points: [50, 50, 50, 50],
            fillColor,
            strokeColor,
            strokeWidth,
            tool: action,
            text: action === ACTIONS.TEXT ? "Sample Text" : "",
            nodeRef: React.createRef(),
          };

          setShapes((prevShapes) => {
            const updatedShapes = [...prevShapes, newImage];

            Id.socket.emit(
              "shapeCreated",
              { shape: { ...newImage, nodeRef: null } },
              Id.roomId
            );

            return updatedShapes;
          });

          console.log("Image upload and socket emit completed.");
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const keyDownHandler = (e) => {
    if (!e.ctrlKey) {
      return; // Exit the handler if Ctrl is not pressed
    }

    const key = e.key.toLowerCase();
    console.log("Key pressed:", e.key);
    console.log("Ctrl pressed:", e.ctrlKey);

    switch (key) {
      case "c": {
        setAction(ACTIONS.CIRCLE);
        break;
      }
      case "e": {
        setAction(ACTIONS.ELLIPSE);
        break;
      }
      case "r": {
        setAction(ACTIONS.RECTANGLE);
        break;
      }
      case "l": {
        setAction(ACTIONS.LINE);
        break;
      }
      case "a": {
        setAction(ACTIONS.ARROW);
        break;
      }
      case "s": {
        setAction(ACTIONS.STAR);
        break;
      }
      case "t": {
        setAction(ACTIONS.TEXT);
        break;
      }
      case "p": {
        setAction(ACTIONS.SELECT);
        break;
      }
      case "d": {
        setAction(ACTIONS.DRAG);
        break;
      }
      case "z": {
        e.preventDefault();
        const undoButton = document.getElementById("UNDO");
        if (undoButton) {
          undoButton.click();
        }
        break;
      }
      case "y": {
        e.preventDefault();
        const redoButton = document.getElementById("REDO");
        if (redoButton) {
          redoButton.click();
        }
        break;
      }
      case "delete": {
        const deleteButton = document.getElementById("DELETE");
        if (deleteButton) {
          deleteButton.click();
        }
        break;
      }
      case "escape": {
        clearHandler();
        break;
      }
      case "f": {
        document.getElementById("fill-color").click();
        break;
      }
      case "b": {
        document.getElementById("stroke-color").click();
        break;
      }
      case "+": {
        setStrokeWidth(Math.max(20, strokeWidth + 1));
        break;
      }
      case "-": {
        setStrokeWidth(Math.max(1, strokeWidth - 1));
        break;
      }
      case "i": {
        document.getElementById("image-upload-input").click();
        setAction(ACTIONS.IMAGE);
        break;
      }
      case "enter": {
        handleDownload();
        break;
      }
      default: {
        break;
      }
    }
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={clearHandler} className="icon-btn" id="CLEAR">
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>

        <button
          onClick={() => setAction(ACTIONS.SELECT)}
          className="icon-btn"
          id="SELECT"
        >
          <i className="fa-solid fa-arrow-pointer"></i>
        </button>
        <button
          class="icon-btn"
          id="DRAG"
          onClick={() => setAction(ACTIONS.DRAG)}
        >
          <i class="fa-regular fa-hand"></i>
        </button>

        <button onClick={handleUndo} className="icon-btn" id="UNDO">
          <i class="fa-solid fa-rotate-left"></i>
        </button>

        <button onClick={handleRedo} className="icon-btn" id="REDO">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.CIRCLE)}
          className="icon-btn"
          id="CIRCLE"
        >
          <i className="fa-regular fa-circle"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.ELLIPSE)}
          className="icon-btn"
          id="ELLIPSE"
        >
          <img
            src={`${process.env.PUBLIC_URL}/ellipse.png`}
            alt="Icon"
            className="icon"
          />
        </button>
        <button
          onClick={() => setAction(ACTIONS.RECTANGLE)}
          className="icon-btn"
          id="RECTANGLE"
        >
          <i className="fas fa-square"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.LINE)}
          className="icon-btn"
          id="LINE"
        >
          <i className="fas fa-minus"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.ARROW)}
          className="icon-btn"
          id="ARROW"
        >
          <i className="fas fa-long-arrow-alt-right"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.STAR)}
          className="icon-btn"
          id="STAR"
        >
          <i className="fas fa-star"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.RING)}
          className="icon-btn"
          id="RING"
        >
          <i class="fa-solid fa-circle-dot"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.ARC)}
          className="icon-btn"
          id="ARC"
        >
          <img
            src={`${process.env.PUBLIC_URL}/Arc.png`}
            alt="Icon"
            className="icon"
          />
        </button>
        <button
          onClick={() => setAction(ACTIONS.TEXT)}
          className="icon-btn"
          id="TEXT"
        >
          <i className="fas fa-font"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.LABEL)}
          className="icon-btn"
          id="LABEL"
        >
          <i className="fas fa-tag"></i>
        </button>
        <button
          onClick={() => setAction(ACTIONS.SCRIBBLE)}
          className="icon-btn"
          id="SCRIBBLE"
        >
          <i className="fas fa-pencil-alt"></i>
        </button>
        <div className="color-picker">
          <button className="icon-btn" id="fill-drip">
            <i className="fas fa-fill-drip"></i>
          </button>

          <input
            type="color"
            id="fill-color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
          />
        </div>
        <div className="color-picker">
          <button className="icon-btn" id="paint-brush">
            <i className="fas fa-paint-brush"></i>
          </button>
          <input
            type="color"
            id="stroke-color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
          />
        </div>
        <button onClick={deleteShape} className="icon-btn" id="DELETE">
          <i class="fa-solid fa-trash"></i>
        </button>
        <div className="stroke-width-slider">
          <button className="icon-btn" id="slider">
            <i className="fas fa-sliders-h"></i>
          </button>
          <input
            type="range"
            id="stroke-width"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(e.target.value)}
          />
        </div>
        {/* <button class="icon-btn" id="import-image">
          <i class="fas fa-image"></i>
        </button> */}

        <button
          className="export-btn"
          id="export-image"
          onClick={handleDownload}
        >
          <i className="fas fa-file-image"></i>
        </button>

        <div className="dropdown">
          <button className="icon-btn dropdown-toggle" onClick={toggleDropdown}>
            <i className="fas fa-users"></i>
          </button>
          {isDropdownOpen && (
            <div className="dropdown-content">
              {users.map(
                (userr) =>
                  user.email !== userr.email && (
                    <div key={userr.email} className="dropdown-item">
                      <span onClick={() => setSelectedUser(userr)}>
                        {userr.name}
                      </span>
                      {isAdmin && selectedUser === userr && (
                        <div className="admin-controls">
                          <button
                            onClick={() => {
                              Id.setCurrentUser(userr);
                              handleUserAction("grantPermission");
                            }}
                            className="admin-action-btn"
                          >
                            <i className="fas fa-check"></i> Grant Permission
                          </button>
                          <button
                            onClick={() => {
                              Id.setCurrentUser(userr);
                              handleUserAction("revokePermission");
                            }}
                            className="admin-action-btn"
                          >
                            <i className="fas fa-times"></i> Revoke Permission
                          </button>
                          <button
                            onClick={() => {
                              Id.setCurrentUser(userr);
                              handleUserAction("kickUser");
                            }}
                            className="admin-action-btn"
                          >
                            <i className="fas fa-user-times"></i> Kick Out
                          </button>
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      </div>

      <div id="whiteboard" ref={containerRef}>
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              transformerRef.current.nodes([]);
            }
          }}
          onClick={onClick}
          draggable={action === ACTIONS.DRAG}
          onWheel={handleWheel}
          onDragMove={handleDragMove}
        >
          <Layer ref={layerRef}>
            {backgroundTiles}
            {shapes.map((shape) => drawShape(shape))}
            {selectionBox && (
              <Rect
                x={selectionBox.x}
                y={selectionBox.y}
                width={selectionBox.width}
                height={selectionBox.height}
                stroke="black"
                strokeWidth={1}
                dash={[10, 5]}
                fill="rgba(0,0,255,0.1)"
              />
            )}
            <Transformer ref={transformerRef} />

            {/* Render other users' pointers and usernames */}
            {otherUsersPointers &&
              Object.entries(otherUsersPointers).map(([email, pointer]) => {
                const actionImage = actionImages[pointer.action];

                return (
                  actionImage instanceof HTMLImageElement && (
                    <React.Fragment key={email}>
                      <KonvaImage
                        x={pointer.x}
                        y={pointer.y}
                        image={actionImage}
                        width={20}
                        height={20}
                        offsetX={15} // Center the image
                        offsetY={15}
                      />

                      <Rect
                        x={pointer.x}
                        y={pointer.y}
                        width={20}
                        height={20}
                        fill={getUserColor(email)}
                        opacity={0.5} // opacity for effect
                        offsetX={15}
                        offsetY={15}
                      />

                      {/* Render the username below the pointer */}
                      <Text
                        x={pointer.x}
                        y={pointer.y - 25} // Display the name below the image
                        text={email}
                        fontSize={18}
                        fill={getUserColor(email)}
                        align="center"
                      />
                    </React.Fragment>
                  )
                );
              })}
          </Layer>
        </Stage>

        {editingText && (
          <textarea
            type="text"
            value={textInput}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            autoFocus
            style={{
              position: "absolute",
              top: stageRef.current?.getPointerPosition()?.y || 0,
              left: stageRef.current?.getPointerPosition()?.x || 0,
              fontSize: `${20}px`,
              border: "1px solid black",
            }}
          />
        )}
      </div>
    </div>
  );
}
export default Whiteboard;
